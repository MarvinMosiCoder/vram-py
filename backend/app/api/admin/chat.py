import logging
from datetime import datetime
from functools import partial
from math import ceil
from random import uniform
from time import sleep

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from google import genai
from google.genai import errors, types
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.helpers.chat_helpers import (
    RESPONSE_TOKEN_LIMITS,
    ModelReply,
    build_reply_prompt,
    call_with_cache,
    check_chat_rate_limit,
    list_conversations,
    load_conversation,
    save_conversation,
    summarize_if_needed,
)
from app.helpers.fake_api import fake_agent_call
from app.helpers.gemini_errors import quota_refusal

load_dotenv()

logger = logging.getLogger(__name__)

_client = None


def _get_client() -> genai.Client:
    """Build the Gemini client on first use rather than at import.

    ``genai.Client()`` raises when ``GEMINI_API_KEY`` is absent, so building it
    at module level made the entire admin API fail to boot without a key - the
    situation stub mode exists for. Resolved once and reused, in the same shape
    as ``get_redis``. Two threads racing here only build a second client and
    throw it away, so no lock is needed.
    """
    global _client

    if _client is None:
        _client = genai.Client()

    return _client


router = APIRouter(tags=["chat"])

RETRY_ATTEMPTS = 3
RETRY_BASE_DELAY = 1.0
RETRY_MAX_DELAY = 8.0
RETRY_STATUS_CODES = {429, 500, 502, 503, 504}


def call_agent(
    prompt: str, model: str, max_output_tokens: int, purpose: str = "reply"
) -> ModelReply:
    """Send one prompt to the model and record what it cost.

    **This is the provider-specific function in the chat stack**, together
    with ``_get_client`` that builds its client and ``helpers/gemini_errors.py``
    that reads its failures. Every layer above is neutral, so swapping providers
    means rewriting those and nothing else. The Gemini coupling lives here:
    ``genai.Client``, ``types.GenerateContentConfig``,
    ``types.FinishReason``, and the ``usage_metadata`` field names.

    ``purpose`` only labels the log line - "reply" or "summary" - so the two
    kinds of call can be told apart when reading token usage. This is also the
    only function that reaches the API, which is what makes a missing log line a
    reliable signal that the response cache served the request instead.
    ``fake_api.fake_agent_call`` logs the same line marked ``stub=1``, so a
    stub reply can never be mistaken for a billed one.
    """
    response = _get_client().models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=max_output_tokens,
        ),
    )

    candidate = (response.candidates or [None])[0]
    usage = response.usage_metadata

    logger.info(
        "agent call=%s model=%s in=%s out=%s total=%s",
        purpose,
        model,
        getattr(usage, "prompt_token_count", None),
        getattr(usage, "candidates_token_count", None),
        getattr(usage, "total_token_count", None),
    )

    return ModelReply(
        text=response.text or "",
        truncated=bool(
            candidate and candidate.finish_reason == types.FinishReason.MAX_TOKENS
        ),
        prompt_tokens=getattr(usage, "prompt_token_count", None),
        output_tokens=getattr(usage, "candidates_token_count", None),
        total_tokens=getattr(usage, "total_token_count", None),
    )


# Chosen once, at the innermost layer on purpose: every layer above - cache,
# retry, backoff, error conversion - stays in the path in stub mode.
_agent_call = fake_agent_call if settings.CHAT_FAKE else call_agent


def call_agent_with_retry(
    prompt: str, model: str, max_output_tokens: int, purpose: str = "reply"
) -> ModelReply:
    """Retry throttled or transient model failures with exponential backoff.

    ``errors.APIError`` is Gemini's exception type; a different provider
    would need its own here alongside a new ``call_agent``. ``fake_api`` raises
    it too, so a `/fail 503` message drives this loop - a `/fail 400` the
    conversion below, and a `/fail 429 daily` the refusal - without spending
    quota.

    Not every 429 is a throttle worth waiting out: ``quota_refusal`` separates
    the per-minute kind, which clears inside ``RETRY_MAX_DELAY``, from a quota
    that cannot clear before the retries run out.
    """
    last_error = None

    for attempt in range(RETRY_ATTEMPTS):
        try:
            return _agent_call(prompt, model, max_output_tokens, purpose)
        except errors.APIError as error:
            last_error = error

            if error.code == 429:
                refusal = quota_refusal(error, RETRY_MAX_DELAY)

                if refusal is not None:
                    wait, daily = refusal

                    # An exhausted daily quota cannot succeed before it resets,
                    # so sleeping through the backoff only delays the same
                    # failure by ~4.5s and then reports it as "try again
                    # shortly". Refuse it now, and say what actually happened.
                    logger.error(
                        "agent call=%s model=%s quota exhausted wait=%ss: %s",
                        purpose,
                        model,
                        ceil(wait),
                        error.message,
                    )

                    minutes = ceil(wait / 60)

                    raise HTTPException(
                        status_code=429,
                        detail=(
                            "The daily AI quota has run out. Chat will work "
                            "again once the quota resets."
                            if daily
                            else "The assistant is out of quota for about "
                            f"{minutes} more minute{'' if minutes == 1 else 's'}. "
                            "Please try again later."
                        ),
                        headers={"Retry-After": str(ceil(wait))},
                    ) from error

            if error.code not in RETRY_STATUS_CODES:
                # Deterministic failures - a retired model id is a 404, a
                # malformed request a 400 - never succeed on a second attempt.
                # Raising the raw APIError here escaped the route unhandled and
                # reached the browser as a bare 500 with no `detail`, so the
                # composer could only show its generic fallback. Convert it, and
                # log the provider's own wording for the server side.
                logger.error(
                    "agent call=%s model=%s failed code=%s: %s",
                    purpose,
                    model,
                    error.code,
                    error.message,
                )

                raise HTTPException(
                    status_code=502,
                    detail=f"The assistant rejected the request: {error.message}",
                ) from error

            if attempt == RETRY_ATTEMPTS - 1:
                break

            delay = min(RETRY_BASE_DELAY * (2 ** attempt), RETRY_MAX_DELAY)

            sleep(delay * uniform(0.5, 1.5))

    raise HTTPException(
        status_code=503,
        detail="The assistant is busy right now. Please try again shortly.",
        headers={"Retry-After": str(int(RETRY_MAX_DELAY))},
    ) from last_error


# The two entry points the route uses. Both share one cache, and each stacks the
# same layers: cache, then retry, then the model - or the stub, when
# CHAT_FAKE is set. They differ only in the label
# the token log records.
def reply_call(prompt: str, model: str, max_output_tokens: int) -> ModelReply:
    return call_with_cache(prompt, model, max_output_tokens, call_agent_with_retry)


def summary_call(prompt: str, model: str, max_output_tokens: int) -> ModelReply:
    return call_with_cache(
        prompt,
        model,
        max_output_tokens,
        partial(call_agent_with_retry, purpose="summary"),
    )


@router.post("/chat")
def chat(
    req: schemas.ChatRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logger.info("chat request user=%s", current_user.id)

    check_chat_rate_limit(current_user.id)

    conversation = load_conversation(db, current_user.id, req.conversation_id)

    # A turn can cost one model call or two, because summarization fires only
    # once history reaches SUMMARIZE_AFTER_MESSAGES. Collecting every reply here
    # is what lets the response report the whole turn rather than just the last
    # call. The list is local to the request: this route is `def`, so FastAPI
    # runs it in a threadpool and a module-level list would mix users together.
    model_calls = []

    def recorded_summary_call(prompt, model, max_output_tokens):
        """Wrap summary_call so its cost is captured; summarize_if_needed
        decides whether to call it, so there is no return value to read."""
        result = summary_call(prompt, model, max_output_tokens)
        model_calls.append(result)

        return result

    summary, history = summarize_if_needed(
        conversation.summary,
        [schemas.ChatMessage(**item) for item in conversation.recent_messages],
        recorded_summary_call,
    )

    prompt = build_reply_prompt(summary, history, req.message)

    reply = reply_call(prompt, req.model, RESPONSE_TOKEN_LIMITS[req.response_length])
    model_calls.append(reply)

    save_conversation(db, conversation, summary, history, req.message, reply.text)

    def token_total(field: str) -> int:
        """Sum one token field across the turn; the counts are optional."""
        return sum(getattr(call, field) or 0 for call in model_calls)

    return {
        "reply": reply.text,
        "conversation_id": conversation.id,
        "truncated": reply.truncated,
        "usage": {
            "prompt_tokens": token_total("prompt_tokens"),
            "output_tokens": token_total("output_tokens"),
            "total_tokens": token_total("total_tokens"),
            "calls": len(model_calls),
            "cached": all(call.cached for call in model_calls),
        },
    }


@router.get("/chat/conversations", response_model=list[schemas.ChatConversationsOut])
def get_conversations(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_conversations(db, current_user.id)


@router.get("/chat/conversations/{conversation_id}")
def conversation_messages(
    conversation_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = load_conversation(db, current_user.id, conversation_id)

    return {
        "conversation_id": conversation.id,
        "messages": conversation.recent_messages or [],
    }

@router.post("/conversation-settings")
def conversation_settings(
    payload: schemas.ConversationSettings,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Apply one rail menu action to one of the caller's conversations.

    `load_conversation` filters on the owner, so another user's id raises 404
    before any of these branches run.
    """
    conversation = load_conversation(db, current_user.id, payload.conversation_id)

    if payload.action == "rename":
        if not payload.title:
            raise HTTPException(
                status_code=422,
                detail="A title is required to rename a conversation.",
            )

        conversation.title = payload.title
        message = "Conversation renamed!"

    elif payload.action == "pin":
        # A toggle rather than a set, so the one menu entry does both.
        conversation.pinned = not conversation.pinned
        message = "Conversation pinned!" if conversation.pinned else "Conversation unpinned!"

    elif payload.action == "archive":
        conversation.archived_at = datetime.now()
        message = "Conversation archived!"

    else:
        db.delete(conversation)
        db.commit()

        return {"message": "Conversation deleted successfully!", "status": "success"}

    db.commit()

    return {"message": message, "status": "success"}


@router.get("/")
def health_check():
    return {"status": "backend is running"}
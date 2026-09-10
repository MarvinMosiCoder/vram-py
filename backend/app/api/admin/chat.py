from dotenv import load_dotenv
from random import uniform
from time import sleep
from fastapi import APIRouter, Depends, HTTPException
from google import genai
from google.genai import types, errors
from app import schemas, models
from app.core.auth import get_current_user
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.helpers.chat_helpers import (
    RESPONSE_TOKEN_LIMITS,
    build_chat_response,
    build_reply_prompt,
    check_chat_rate_limit,
    summarize_if_needed,
    cached_api_call,
    load_conversation,
    save_conversation,
    list_conversations,
    ModelReply,
)

load_dotenv()
client = genai.Client()

router = APIRouter(tags=["chat"])
RETRY_ATTEMPTS = 3
RETRY_BASE_DELAY = 1.0
RETRY_MAX_DELAY = 8.0
RETRY_STATUS_CODES = {429, 500, 502, 503, 504}

def real_api_call(message: str, model: str, response_length: int) -> ModelReply:
    response = client.models.generate_content(
        model=model,
        contents=message,
        config=types.GenerateContentConfig(
            max_output_tokens=response_length,
        ),
    )

    candidate = (response.candidates or [None])[0]

    return ModelReply(
        text=response.text or "",
        truncated=bool(
            candidate and candidate.finish_reason == types.FinishReason.MAX_TOKENS
        ),
    )

def retrying_api_call(prompt: str, model: str, response_length: int) -> ModelReply:
    """Retry throttled or transient Gemini failures with exponential backoff."""
    last_error = None

    for attempt in range(RETRY_ATTEMPTS):
        try:
            return real_api_call(prompt, model, response_length)
        except errors.APIError as error:
            last_error = error

            if error.code not in RETRY_STATUS_CODES:
                raise

            if attempt == RETRY_ATTEMPTS - 1:
                break

            delay = min(RETRY_BASE_DELAY * (2 ** attempt), RETRY_MAX_DELAY)

            sleep(delay * uniform(0.5, 1.5))

    raise HTTPException(
        status_code=503,
        detail="The assistant is busy right now. Please try again shortly.",
        headers={"Retry-After": str(int(RETRY_MAX_DELAY))},
    ) from last_error


def cached_call(prompt: str, model: str, response_length: int) -> ModelReply:
    return cached_api_call(prompt, model, response_length, retrying_api_call)


@router.post("/chat")
def chat(
    req: schemas.ChatRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_chat_rate_limit(current_user.id)
    
    conversation = load_conversation(db, current_user.id, req.conversation_id)
    
    summary, history = summarize_if_needed(
        conversation.summary, 
         [schemas.ChatMessage(**item) for item in conversation.recent_messages],
        cached_call
    )

    prompt = build_reply_prompt(summary, history, req.message)
    
    reply = cached_call(
        prompt,
        req.model,
        RESPONSE_TOKEN_LIMITS[req.response_length],
    )

    save_conversation(db, conversation, summary, history, req.message, reply.text)

    return {
        "reply": reply.text,
        "conversation_id": conversation.id,
        "truncated": reply.truncated,
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


@router.get("/")
def health_check():
    return {"status": "backend is running"}
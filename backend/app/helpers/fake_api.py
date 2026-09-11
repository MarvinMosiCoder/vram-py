"""Stub provider for development. Nothing in here reaches an API.

``CHAT_FAKE=1`` swaps ``fake_agent_call`` in for ``call_agent`` at the innermost
layer of the chat stack, so the cache, the retry loop, the backoff, and the
error conversion above it all stay in the path and keep being exercised. The
free tier allows 20 requests a day and one agent task can make 40 calls, so
developing anything above that function has to be possible without touching the
API at all.

It lives apart from ``app/api/admin/chat.py`` so that module carries only the
real provider call and the request handling.
"""

import logging
from random import uniform
from time import sleep

from google.genai import errors

from app.core.config import settings
from app.helpers.chat_helpers import ModelReply, latest_message_from_prompt
from app.helpers.gemini_errors import QUOTA_FAILURE_TYPE, RETRY_INFO_TYPE

logger = logging.getLogger(__name__)

LATENCY_SECONDS = 0.4
CHARS_PER_TOKEN = 4
FAIL_MARKER = "/fail"
DAILY_MARKER = "daily"
LONG_MARKER = "/long"
DEFAULT_FAIL_CODE = 503

REPLY_TEMPLATE = """**Stub reply.** `CHAT_FAKE=1` is set, so this turn never
reached the API and spent no quota.

You asked:

> {message}

Everything except the model call is real - the message was stored, summarized
once the history grew long enough, counted against the rate limit, and cached
under the key a live reply would have used.

These markers change what this stub does:

- `/long` pads the reply past the requested token cap, so the truncation notice appears.
- `/fail 503` raises that provider error, so retry, backoff, and the error paths run.
- `/fail 429 daily` injects an exhausted daily quota, which is refused without retrying.
"""

SUMMARY_TEMPLATE = (
    "Stub summary of {count} characters of history. CHAT_FAKE=1 is set, so no "
    "summary was generated; the conversation continues from its recent messages."
)

FILLER = (
    "This sentence is padding, so the reply runs past the output token cap and "
    "the truncation branch fires. "
)


def _injected_failure(message: str) -> tuple[int, bool] | None:
    """Read the code and the daily flag out of a `/fail [code] [daily]` message.

    ``None`` when the marker is absent. A bare `/fail` means 503, so the default
    lands on a retryable code and exercises the backoff. `daily` only means
    anything alongside 429; see ``_error_body``.
    """
    _, marker, tail = message.partition(FAIL_MARKER)

    if not marker:
        return None

    words = tail.split()
    code = int(words[0]) if words and words[0].isdigit() else DEFAULT_FAIL_CODE

    return code, DAILY_MARKER in words


def _error_body(code: int, daily: bool) -> dict:
    """The response body a provider would send for an injected failure.

    A 429 carries the ``google.rpc`` details ``quota_refusal`` reads, so
    both halves of the 429 split are reachable without spending quota: a
    per-minute throttle that clears and is retried, and a daily quota that never
    can be and is refused immediately.
    """
    body = {
        "error": {
            "code": code,
            "message": f"Injected {code} from CHAT_FAKE stub mode.",
            "status": "STUB_INJECTED_FAILURE",
        }
    }

    if code != 429:
        return body

    body["error"]["status"] = "RESOURCE_EXHAUSTED"
    body["error"]["details"] = [
        {
            "@type": QUOTA_FAILURE_TYPE,
            "violations": [
                {
                    "quotaMetric": (
                        "generativelanguage.googleapis.com/"
                        "generate_content_free_tier_requests"
                    ),
                    "quotaId": (
                        "GenerateRequestsPerDayPerProjectPerModel-FreeTier"
                        if daily
                        else "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"
                    ),
                }
            ],
        },
        {"@type": RETRY_INFO_TYPE, "retryDelay": "3600s" if daily else "2s"},
    ]

    return body


def fake_agent_call(
    prompt: str, model: str, max_output_tokens: int, purpose: str = "reply"
) -> ModelReply:
    """Stand in for ``call_agent`` when ``CHAT_FAKE`` is set.

    It imitates the parts of a real call that the layers above and the composer
    read, because a stub that returns zeros makes development look healthy while
    hiding bugs: the output cap is honoured, so ``truncated`` is reached the same
    way it is in production; token counts are estimated rather than left empty,
    so the usage line and the token log stay readable; and a latency is slept,
    because an instant reply hides the submission lock and the typing indicator.
    """
    message = latest_message_from_prompt(prompt)
    failure = _injected_failure(message)

    sleep(LATENCY_SECONDS * uniform(0.5, 1.5))

    if failure is not None:
        code, daily = failure

        # Raised as the provider's own exception type, with the provider's own
        # body, so it lands in `call_agent_with_retry` exactly as a real failure
        # would: refused outright when the quota cannot clear, retried when the
        # code is in RETRY_STATUS_CODES, converted to a 502 when it is not.
        raise errors.APIError(code, _error_body(code, daily))

    if purpose == "summary":
        text = SUMMARY_TEMPLATE.format(count=len(prompt))
    else:
        text = REPLY_TEMPLATE.format(message=message or "(no message)")

        if LONG_MARKER in message:
            text += "\n\n" + FILLER * (
                max_output_tokens * CHARS_PER_TOKEN // len(FILLER) + 1
            )

    # The cap is applied to every stub reply, not just a padded one, so the
    # response length selector changes the output here as it does in production.
    budget = max_output_tokens * CHARS_PER_TOKEN
    truncated = len(text) > budget

    if truncated:
        text = text[:budget]

    prompt_tokens = max(1, len(prompt) // CHARS_PER_TOKEN)
    output_tokens = max(1, len(text) // CHARS_PER_TOKEN)

    logger.info(
        "agent call=%s model=%s in=%s out=%s total=%s stub=1",
        purpose,
        model,
        prompt_tokens,
        output_tokens,
        prompt_tokens + output_tokens,
    )

    return ModelReply(
        text=text,
        truncated=truncated,
        prompt_tokens=prompt_tokens,
        output_tokens=output_tokens,
        total_tokens=prompt_tokens + output_tokens,
    )


if settings.CHAT_FAKE:
    logger.warning(
        "CHAT_FAKE is set: chat replies are canned stubs and no API call will "
        "be made. Unset it before judging a reply's quality."
    )

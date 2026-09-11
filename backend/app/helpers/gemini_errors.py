"""Reading a Gemini error body.

The chat stack is provider-neutral above ``call_agent``; that function and this
module are where the Gemini coupling lives. A failed request carries
``google.rpc`` detail objects, and what the retry path is allowed to do with a
429 depends on them, so they are parsed here rather than in the route module.
"""

from google.genai import errors

# Detail objects carried by a Gemini 429. See `quota_refusal`.
RETRY_INFO_TYPE = "type.googleapis.com/google.rpc.RetryInfo"
QUOTA_FAILURE_TYPE = "type.googleapis.com/google.rpc.QuotaFailure"
SECONDS_PER_DAY = 86400


def _error_detail(error: errors.APIError, type_url: str) -> dict:
    """One ``google.rpc`` detail object off an ``APIError``, or an empty dict.

    ``APIError.details`` is the raw response body, which arrives either bare or
    wrapped in ``error`` - the SDK unwraps a single-element list but not that
    envelope - so both shapes are handled here.
    """
    body = error.details if isinstance(error.details, dict) else {}
    body = body.get("error", body)
    items = body.get("details")

    if not isinstance(items, list):
        return {}

    return next(
        (
            item
            for item in items
            if isinstance(item, dict) and item.get("@type") == type_url
        ),
        {},
    )


def _retry_delay_seconds(error: errors.APIError) -> float | None:
    """``RetryInfo.retryDelay`` in seconds; ``None`` when the provider sent none.

    The field is a protobuf Duration serialized as a string - "27s", sometimes
    "1.5s" - so it is parsed rather than read as a number.
    """
    raw = _error_detail(error, RETRY_INFO_TYPE).get("retryDelay")

    try:
        return float(str(raw).removesuffix("s"))
    except (TypeError, ValueError):
        return None


def quota_refusal(
    error: errors.APIError, budget_seconds: float
) -> tuple[float, bool] | None:
    """``None`` when a 429 is worth retrying, else ``(wait seconds, is daily)``.

    Two different quotas return 429. A per-minute throttle clears within a
    caller's backoff budget and should be retried. A daily quota cannot:
    retrying spends the whole budget on calls that are all certain to fail, and
    then reports the failure as "try again shortly", which is wrong.

    ``budget_seconds`` is the longest single delay the caller is willing to
    sleep, so the retry constants stay with the retry loop rather than moving
    here.

    ``quotaId`` names the window ("...PerDay..." against "...PerMinute..."), but
    the ``RetryInfo`` comparison is what the decision really rests on: any 429
    whose own retry hint exceeds that budget is not retryable, whatever the
    quota is called. Both details are optional, and a 429 carrying neither is
    left to the caller's retry path.
    """
    delay = _retry_delay_seconds(error)
    violations = _error_detail(error, QUOTA_FAILURE_TYPE).get("violations") or []

    daily = any(
        "PerDay" in item.get("quotaId", "")
        for item in violations
        if isinstance(item, dict)
    )

    if daily:
        # No RetryInfo still must not retry; report a day rather than guess the
        # reset instant, which the error body does not carry.
        return delay or SECONDS_PER_DAY, True

    if delay is not None and delay > budget_seconds:
        # Some other quota with a wait longer than the backoff budget. Not
        # retryable either, but it is not the daily one, so the caller must not
        # say so.
        return delay, False

    return None

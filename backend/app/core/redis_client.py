"""Shared Redis connection for state that must outlive a single worker.

The chat rate limiter and response cache both live in process memory by
default, which is correct while one worker serves every request. Set
``REDIS_URL`` before running more than one worker: without it each worker keeps
its own counts and its own cache, so ten requests per minute becomes ten *per
worker* and a cached reply only helps the worker that produced it.

``redis`` is an optional dependency. It is imported lazily so a project that
never sets ``REDIS_URL`` does not need the package installed at all.
"""

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

_client = None
_resolved = False


def get_redis():
    """Return a shared Redis client, or ``None`` to use in-process state.

    Resolved once per process. A URL that is set but unreachable logs a warning
    and returns ``None`` rather than raising, so a Redis outage degrades the
    limiter and cache to per-worker behaviour instead of taking chat down.
    """
    global _client, _resolved

    if _resolved:
        return _client

    _resolved = True

    if not settings.REDIS_URL:
        return None

    try:
        import redis

        client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        client.ping()
    except ImportError:
        logger.warning(
            "REDIS_URL is set but the redis package is not installed; "
            "falling back to in-process state. Run: pip install redis"
        )

        return None
    except Exception as error:
        logger.warning(
            "REDIS_URL is set but Redis is unreachable (%s); "
            "falling back to in-process state.",
            error,
        )

        return None

    logger.info("Using Redis for the chat rate limiter and response cache.")
    _client = client

    return _client


def reset_redis_for_tests() -> None:
    """Clear the memoized client so a test can swap the backend."""
    global _client, _resolved

    _client = None
    _resolved = False

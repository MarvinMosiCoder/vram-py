""" memecoin helpers """
import httpx


def dig(data, *keys):
    """Walk nested keys, returning None as soon as one is missing."""
    for key in keys:
        if not isinstance(data, dict):
            return None
        data = data.get(key)
    return data


def describe(error: Exception) -> str:
    """A readable one-line reason for a failed source."""
    if isinstance(error, httpx.HTTPStatusError):
        return f"HTTP {error.response.status_code}: {error.response.text[:200]}"
    # Timeouts often carry no message, so fall back to the error's class name.
    return f"{type(error).__name__}: {error}" if str(error) else type(error).__name__

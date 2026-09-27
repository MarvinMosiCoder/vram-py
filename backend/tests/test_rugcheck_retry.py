"""RugCheck's HTTP 429 handling, against a fake server: no network, no waiting."""
import asyncio

import httpx
import pytest

from app.helpers.memecoin import rugcheck

MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"


@pytest.fixture
def waits(monkeypatch):
    """Record each sleep instead of sleeping."""
    slept = []

    async def fake_sleep(seconds):
        slept.append(seconds)

    monkeypatch.setattr(rugcheck.asyncio, "sleep", fake_sleep)
    return slept


def fetch(*responses: httpx.Response) -> tuple[dict | Exception, int]:
    """Run fetch_report against a server that gives these responses in order.

    Returns the report (or the raised error) and how many requests were made.
    """
    queue = list(responses)
    requests = []

    def server(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return queue.pop(0)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(server)) as client:
            try:
                return await rugcheck.fetch_report(client, MINT)
            except httpx.HTTPError as error:
                return error

    return asyncio.run(run()), len(requests)


def test_one_429_is_retried(waits):
    report, requests = fetch(httpx.Response(429), httpx.Response(200, json={"mint": MINT}))

    assert report == {"mint": MINT}
    assert requests == 2
    assert waits == [rugcheck.RETRY_WAIT_SECONDS]


def test_a_second_429_is_raised(waits):
    error, requests = fetch(httpx.Response(429), httpx.Response(429))

    assert isinstance(error, httpx.HTTPStatusError)
    assert error.response.status_code == 429
    assert requests == 2


def test_other_errors_are_not_retried(waits):
    error, requests = fetch(httpx.Response(400, json={"error": "invalid mint"}))

    assert error.response.status_code == 400
    assert requests == 1
    assert waits == []


@pytest.mark.parametrize("header, wait", [
    ("3", 3),
    ("600", rugcheck.MAX_RETRY_WAIT_SECONDS),
    ("Wed, 21 Oct 2026 07:28:00 GMT", rugcheck.RETRY_WAIT_SECONDS),
])
def test_retry_after_is_followed_within_limits(waits, header, wait):
    fetch(httpx.Response(429, headers={"Retry-After": header}), httpx.Response(200, json={}))
    assert waits == [wait]

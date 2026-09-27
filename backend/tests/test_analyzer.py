"""Report building: what the command line prints and the API returns."""
import asyncio

import httpx
import pytest

from app import schemas
from app.helpers.memecoin import analyzer

BONK = "bonk-DezXAZ8z"
BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"


def test_failed_source_becomes_an_error_not_a_crash(sources):
    report = analyzer.build_report(BONK_MINT, sources(BONK, rugcheck=httpx.ConnectTimeout("")))

    assert report.market is not None
    assert report.safety is None
    assert report.errors == {"rugcheck": "ConnectTimeout"}
    assert report.assessment.verdict != "Watch"


def test_report_survives_the_trip_through_json(sources):
    # The API sends the report as JSON; nothing may be lost on the way.
    report = analyzer.build_report(BONK_MINT, sources(BONK))
    assert schemas.CoinReport.model_validate_json(report.model_dump_json()) == report


# --- Website lookups in collect() and build_report() -----------------------------

@pytest.fixture
def fake_sources(monkeypatch, raw):
    """Replace every fetch with saved data. Returns the domains looked up."""
    def install(coin: str, pairs_error: Exception | None = None):
        looked_up = []

        async def pairs(client, chain, address):
            if pairs_error:
                raise pairs_error
            return raw(coin, "dexscreener")

        async def report(client, address):
            return raw(coin, "rugcheck")

        async def rdap(client, domain):
            looked_up.append(("rdap", domain))
            return raw(coin, "rdap")

        async def wayback(client, domain):
            looked_up.append(("wayback", domain))
            raise httpx.HTTPStatusError("429", request=httpx.Request("GET", "https://archive.org"), response=httpx.Response(429, text="Too Many Requests"))

        monkeypatch.setattr(analyzer.dexscreener, "fetch_token_pairs", pairs)
        monkeypatch.setattr(analyzer.rugcheck, "fetch_report", report)
        monkeypatch.setattr(analyzer.web, "fetch_rdap", rdap)
        monkeypatch.setattr(analyzer.web, "fetch_wayback", wayback)
        return looked_up

    return install


def test_the_website_is_looked_up_after_dexscreener_names_it(fake_sources, raw):
    looked_up = fake_sources(BONK)
    sources = asyncio.run(analyzer.collect(BONK_MINT))

    assert sorted(looked_up) == [("rdap", "bonkcoin.com"), ("wayback", "bonkcoin.com")]
    assert sources.rdap == raw(BONK, "rdap")
    assert isinstance(sources.wayback, httpx.HTTPStatusError)


def test_no_website_means_no_lookup(fake_sources, raw):
    looked_up = fake_sources("stonkwheel-FAvikGwx")
    mint = raw("stonkwheel-FAvikGwx", "rugcheck")["mint"]
    sources = asyncio.run(analyzer.collect(mint))

    report = analyzer.build_report(mint, sources)
    assert report.market is not None and report.market.websites == []  # found, but lists no site
    assert looked_up == [] and sources.rdap is None


def test_no_dexscreener_means_no_lookup(fake_sources):
    looked_up = fake_sources(BONK, pairs_error=httpx.ConnectTimeout(""))
    asyncio.run(analyzer.collect(BONK_MINT))
    assert looked_up == []


def test_a_failed_wayback_lookup_does_not_count_as_an_error(sources):
    wayback_down = httpx.HTTPStatusError("429", request=httpx.Request("GET", "https://archive.org"), response=httpx.Response(429, text="Too Many Requests"))
    report = analyzer.build_report(BONK_MINT, sources(BONK, wayback=wayback_down))

    assert report.errors == {}  # so the report can still be cached
    assert report.web.wayback_error == "HTTP 429: Too Many Requests"
    assert report.web.domain == "bonkcoin.com"


def test_a_failed_rdap_lookup_is_an_error_and_leaves_the_domain_unchecked(sources, raw):
    mint = raw("epump-7haJedyf", "rugcheck")["mint"]
    report = analyzer.build_report(mint, sources("epump-7haJedyf", rdap=httpx.ConnectTimeout("")))

    assert report.web.domain == "e-pump.app" and report.web.domain_age_days is None
    assert report.errors == {"rdap": "ConnectTimeout"}
    assert "new_domain" in report.assessment.unchecked

"""Website checks: domains, RDAP, Wayback, and the web summary. No network."""
from datetime import datetime, timezone

import httpx
import pytest

from app import schemas
from app.helpers.memecoin import web


@pytest.mark.parametrize("url, domain", [
    ("https://www.bonkcoin.com", "bonkcoin.com"),
    ("https://docs.shop.foo.xyz/page", "foo.xyz"),
    ("https://shop.example.co.uk/", "example.co.uk"),
    ("https://runescape.wiki/w/Fluffs", "runescape.wiki"),
    ("not a url", None),
])
def test_registrable_domain(url, domain):
    assert web.registrable_domain(url) == domain


def market_with(*websites: str) -> schemas.MarketData:
    return schemas.MarketData(chain="solana", address="x", websites=list(websites))


def test_only_an_own_domain_is_looked_up():
    assert web.domain_to_check(market_with("https://www.e-pump.app/")) == "e-pump.app"
    assert web.domain_to_check(market_with("https://mycoin.vercel.app")) is None
    assert web.domain_to_check(market_with()) is None
    assert web.domain_to_check(None) is None


def test_registration_date_from_saved_rdap(raw):
    assert web.registered_at(raw("bonk-DezXAZ8z", "rdap")) == datetime(2022, 12, 18, 6, 4, 51, tzinfo=timezone.utc)
    assert web.registered_at({"events": []}) is None


def test_first_wayback_snapshot(raw):
    # bonkcoin.com was archived in 2018, four years before its 2022 registration:
    # the domain had an earlier owner, one reason the date is not used by a rule.
    assert web.first_snapshot(raw("bonk-DezXAZ8z", "wayback")) == datetime(2018, 8, 5, 22, 39, 59, tzinfo=timezone.utc)
    assert web.first_snapshot({"url": "new.example", "archived_snapshots": {}}) is None


def test_summary_for_an_own_domain(raw):
    summary = web.summarize_web(market_with("https://www.bonkcoin.com"), raw("bonk-DezXAZ8z", "rdap"), None)
    assert (summary.domain, summary.hosted) == ("bonkcoin.com", False)
    assert summary.domain_age_days > 365


def test_summary_without_a_website_or_market():
    assert web.summarize_web(market_with(), None, None) == schemas.WebData()
    assert web.summarize_web(None, None, None) is None


def test_summary_for_a_shared_host():
    summary = web.summarize_web(market_with("https://mycoin.vercel.app"), None, None)
    assert summary.hosted and summary.domain_age_days is None


def test_failed_lookups_leave_fields_unknown():
    summary = web.summarize_web(market_with("https://www.bonkcoin.com"), httpx.ConnectTimeout(""), httpx.ReadTimeout("slow"))
    assert summary.domain_age_days is None
    assert summary.wayback_error == "ReadTimeout: slow"

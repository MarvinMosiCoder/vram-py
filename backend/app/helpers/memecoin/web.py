"""Website checks: the coin's site from DexScreener, the domain's registration
date from RDAP, and its first Wayback Machine snapshot.

Both services are free and need no key. RDAP feeds the new_domain rule; the
Wayback date is shown for information only, because archive.org rate-limits
hard (HTTP 429) and a flaky source should not move a verdict.
"""
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from app import schemas
from app.helpers.memecoin.common import describe

RDAP_URL = "https://rdap.org/domain/{domain}"
WAYBACK_URL = "https://archive.org/wayback/available"
TIMEOUT_SECONDS = 8
# Shared hosts and link pages. Their age says nothing about the coin, so they
# are not looked up.
HOSTED_DOMAINS = {
    "x.com", "twitter.com", "t.me", "telegram.me", "discord.gg", "discord.com",
    "linktr.ee", "medium.com", "github.io", "github.com", "gitbook.io", "notion.site",
    "vercel.app", "netlify.app", "carrd.co", "wixsite.com", "pump.fun",
    "youtube.com", "tiktok.com", "instagram.com", "facebook.com", "google.com",
}
# Second-level labels under a two-letter country code, as in example.co.uk.
COUNTRY_SECOND_LEVELS = {"co", "com", "net", "org", "gov", "edu", "ac"}


def registrable_domain(url: str) -> str | None:
    """The domain a registry knows: www.shop.example.com -> example.com.

    A short rule rather than the full public suffix list: it handles country
    codes such as .co.uk and gets unusual suffixes wrong.
    """
    host = (urlparse(url).hostname or "").lower()
    labels = [label for label in host.split(".") if label]
    if len(labels) < 2:
        return None
    if len(labels) >= 3 and len(labels[-1]) == 2 and labels[-2] in COUNTRY_SECOND_LEVELS:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def domain_to_check(market: schemas.MarketData | None) -> str | None:
    """The domain worth an RDAP lookup: the first website's, unless shared."""
    if market is None or not market.websites:
        return None
    domain = registrable_domain(market.websites[0])
    return None if domain is None or domain in HOSTED_DOMAINS else domain


async def fetch_rdap(client: httpx.AsyncClient, domain: str) -> dict:
    """RDAP's record for a domain. An unknown domain raises HTTP 404."""
    response = await client.get(RDAP_URL.format(domain=domain), timeout=TIMEOUT_SECONDS, follow_redirects=True)
    response.raise_for_status()
    return response.json()


async def fetch_wayback(client: httpx.AsyncClient, domain: str) -> dict:
    """The snapshot closest to 1996, which is the earliest one archive.org has."""
    response = await client.get(
        WAYBACK_URL, params={"url": domain, "timestamp": "19960101"}, timeout=TIMEOUT_SECONDS, follow_redirects=True
    )
    response.raise_for_status()
    return response.json()


def registered_at(rdap: dict) -> datetime | None:
    for event in rdap.get("events") or []:
        if event.get("eventAction") == "registration" and event.get("eventDate"):
            return datetime.fromisoformat(event["eventDate"].replace("Z", "+00:00"))
    return None


def first_snapshot(wayback: dict) -> datetime | None:
    closest = (wayback.get("archived_snapshots") or {}).get("closest") or {}
    stamp = closest.get("timestamp")
    if not closest.get("available") or not stamp:
        return None
    return datetime.strptime(stamp, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)


def summarize_web(
    market: schemas.MarketData | None,
    rdap: dict | Exception | None,
    wayback: dict | Exception | None,
) -> schemas.WebData | None:
    """What is known about the coin's website. None when DexScreener failed, since
    the website comes from it. A lookup that failed or was skipped leaves its
    field None; the caller reports an RDAP failure in errors."""
    if market is None:
        return None
    if not market.websites:
        return schemas.WebData()

    website = market.websites[0]
    domain = registrable_domain(website)
    registered = registered_at(rdap) if isinstance(rdap, dict) else None
    age_days = (datetime.now(timezone.utc) - registered).total_seconds() / 86400 if registered else None
    return schemas.WebData(
        website=website,
        domain=domain,
        hosted=domain in HOSTED_DOMAINS,
        domain_registered_at=registered,
        domain_age_days=age_days,
        wayback_first_at=first_snapshot(wayback) if isinstance(wayback, dict) else None,
        wayback_error=describe(wayback) if isinstance(wayback, Exception) else None,
    )

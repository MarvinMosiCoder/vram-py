"""The analysis core shared by the command line and the API.

collect() fetches every source for one token; build_report() turns the raw
results into a CoinReport. check.py and the /memecoin routes both call these,
so a report is built the same way wherever it is shown.
"""
import asyncio
import time
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from app import schemas
from app.helpers.memecoin import dexscreener, goplus, rugcheck, rules, web
from app.helpers.memecoin.chains import CHAINS, Chain
from app.helpers.memecoin.common import describe  # noqa: F401 -- also used as analyzer.describe


@dataclass
class Sources:
    """The raw results of one collection. A failed source holds its exception;
    a source that was not needed holds None: RugCheck on EVM chains, GoPlus on
    Solana, and the website lookups when there is no domain to check."""
    pairs: list[dict] | Exception
    rugcheck: dict | Exception | None = None
    goplus: dict | Exception | None = None
    rdap: dict | Exception | None = None
    wayback: dict | Exception | None = None


def safety_request(client: httpx.AsyncClient, chain: Chain, address: str):
    if chain.family == "solana":
        return rugcheck.fetch_report(client, address)
    return goplus.fetch_token_security(client, chain, address)


async def collect(address: str, chain: str = "solana") -> Sources:
    """Fetch every source for one token.

    DexScreener and the safety source (RugCheck or GoPlus) run at the same time.
    The website comes from DexScreener, so its RDAP and Wayback lookups run
    next, also together. return_exceptions=True hands back a failed source's
    exception instead of raising it, so one broken API costs its own section,
    not the whole check.
    """
    network = CHAINS[chain]
    async with httpx.AsyncClient() as client:
        pairs, safety = await asyncio.gather(
            dexscreener.fetch_token_pairs(client, network.id, address),
            safety_request(client, network, address),
            return_exceptions=True,
        )
        sources = Sources(pairs=pairs)
        if network.family == "solana":
            sources.rugcheck = safety
        else:
            sources.goplus = safety

        market = None if isinstance(pairs, Exception) else dexscreener.token_market(pairs, address)
        domain = web.domain_to_check(market)
        if domain:
            sources.rdap, sources.wayback = await asyncio.gather(
                web.fetch_rdap(client, domain),
                web.fetch_wayback(client, domain),
                return_exceptions=True,
            )
        return sources


def build_report(
    address: str,
    sources: Sources,
    blacklist: frozenset[str] = frozenset(),
    chain: str = "solana",
) -> schemas.CoinReport:
    """Turn collect()'s raw results into a report.

    A failed source becomes None plus an entry in errors; the rules then report
    its checks as unchecked. A Wayback failure is kept in web.wayback_error
    instead, since no rule depends on it.
    """
    network = CHAINS[chain]
    errors = {}
    market = None
    safety = None

    if isinstance(sources.pairs, Exception):
        errors["dexscreener"] = describe(sources.pairs)
    else:
        market = dexscreener.token_market(sources.pairs, address)

    if network.family == "solana":
        if isinstance(sources.rugcheck, Exception):
            errors["rugcheck"] = describe(sources.rugcheck)
        elif sources.rugcheck is not None:
            safety = rugcheck.summarize_report(sources.rugcheck)
    else:
        if isinstance(sources.goplus, Exception):
            errors["goplus"] = describe(sources.goplus)
        elif sources.goplus is not None:
            safety = goplus.summarize_security(sources.goplus, address)

    if isinstance(sources.rdap, Exception):
        errors["rdap"] = describe(sources.rdap)
    web_data = web.summarize_web(market, sources.rdap, sources.wayback)

    evidence = rules.Evidence(market=market, safety=safety, blacklist=blacklist, web=web_data, family=network.family)
    return schemas.CoinReport(
        chain=network.id,
        address=address,
        checked_at=datetime.now(timezone.utc),
        market=market,
        safety=safety,
        web=web_data,
        assessment=rules.assess(evidence),
        errors=errors,
    )


# How long analyze() reuses a complete report before fetching again.
CACHE_SECONDS = 5 * 60
# (chain, address) -> (time.monotonic() when built, report). Lives in this
# process only: a restart empties it, and each uvicorn worker keeps its own.
_cache: dict[tuple[str, str], tuple[float, schemas.CoinReport]] = {}


def clear_cache() -> None:
    """Forget every cached report. Called when the blacklist changes, since
    cached reports were judged against the old one."""
    _cache.clear()


async def analyze(address: str, blacklist: frozenset[str] = frozenset(), chain: str = "solana") -> schemas.CoinReport:
    """Collect every source for a token and build its report.

    A complete report is reused for CACHE_SECONDS; its checked_at shows when it
    was fetched. A report with a failed source is not cached, so the next
    request tries that source again.
    """
    cached = _cache.get((chain, address))
    if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
        return cached[1]

    sources = await collect(address, chain)
    report = build_report(address, sources, blacklist, chain)
    if not report.errors:
        _cache[(chain, address)] = (time.monotonic(), report)
    return report

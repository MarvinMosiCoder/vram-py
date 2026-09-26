"""The analysis core shared by the command line and the API.

collect() fetches every source for one Solana token; build_report() turns the
raw results into a CoinReport. check.py and the /memecoin routes both call
these, so a report is built the same way wherever it is shown.
"""
import asyncio
from datetime import datetime, timezone

import httpx

from app import schemas
from app.helpers.memecoin import dexscreener, rugcheck, rules


async def collect(address: str) -> list:
    """Fetch every source for one Solana token at the same time.

    return_exceptions=True hands back a failed source's exception instead of
    raising it, so one broken API costs its own section, not the whole check.
    """
    async with httpx.AsyncClient() as client:
        return await asyncio.gather(
            dexscreener.fetch_token_pairs(client, "solana", address),
            rugcheck.fetch_report(client, address),
            return_exceptions=True,
        )


def describe(error: Exception) -> str:
    """A readable one-line reason for a failed source."""
    if isinstance(error, httpx.HTTPStatusError):
        return f"HTTP {error.response.status_code}: {error.response.text[:200]}"
    # Timeouts often carry no message, so fall back to the error's class name.
    return f"{type(error).__name__}: {error}" if str(error) else type(error).__name__


def build_report(
    address: str,
    pairs: list[dict] | Exception,
    rugcheck_report: dict | Exception,
) -> schemas.CoinReport:
    """Turn collect()'s raw results into a report.

    A failed source becomes None plus an entry in errors; the rules then report
    its checks as unchecked.
    """
    errors = {}
    market = None
    safety = None

    if isinstance(pairs, Exception):
        errors["dexscreener"] = describe(pairs)
    else:
        market = dexscreener.token_market(pairs, address)

    if isinstance(rugcheck_report, Exception):
        errors["rugcheck"] = describe(rugcheck_report)
    else:
        safety = rugcheck.summarize_report(rugcheck_report)

    return schemas.CoinReport(
        address=address,
        checked_at=datetime.now(timezone.utc),
        market=market,
        safety=safety,
        assessment=rules.assess(rules.Evidence(market=market, safety=safety)),
        errors=errors,
    )


async def analyze(address: str) -> schemas.CoinReport:
    """Collect every source for a Solana mint and build its report."""
    pairs, rugcheck_report = await collect(address)
    return build_report(address, pairs, rugcheck_report)

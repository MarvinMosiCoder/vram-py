"""RugCheck collector: on-chain safety facts for a Solana token.

The report endpoint is public and needs no key. Solana mints only.
"""
import asyncio

import httpx

from app import schemas
from app.helpers.memecoin.common import dig

REPORT_URL = "https://api.rugcheck.xyz/v1/tokens/{mint}/report"
# Big coins list every pool they trade in: Bonk's report is about 2.5 MB.
TIMEOUT_SECONDS = 30
# Holders that are pools, not people. A pump.fun bonding curve can hold most of
# the supply; counting it would make every new coin look concentrated.
POOL_HOLDER_TYPES = {"AMM"}

# RugCheck answers HTTP 429 to bursts. Wait this long, or what its Retry-After
# header asks up to the maximum, then retry once.
RETRY_WAIT_SECONDS = 2
MAX_RETRY_WAIT_SECONDS = 10


def retry_wait(response: httpx.Response) -> float:
    """Seconds to wait before retrying a 429. Retry-After can also be a date;
    anything but a number falls back to the default."""
    try:
        seconds = float(response.headers["Retry-After"])
    except (KeyError, ValueError):
        return RETRY_WAIT_SECONDS
    return min(max(seconds, 0), MAX_RETRY_WAIT_SECONDS)


async def fetch_report(client: httpx.AsyncClient, mint: str) -> dict:
    """Return RugCheck's full report for a mint. Errors are raised.

    A 429 is retried once; a second 429 is raised like any other HTTP error.
    """
    url = REPORT_URL.format(mint=mint)
    response = await client.get(url, timeout=TIMEOUT_SECONDS)
    if response.status_code == 429:
        await asyncio.sleep(retry_wait(response))
        response = await client.get(url, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json()


def lp_locked_pct(report: dict) -> float | None:
    """Percent of pool liquidity (in USD) that is locked or burned."""
    total = report.get("totalMarketLiquidity") or 0
    if not total:
        return None
    locked = sum(dig(m, "lp", "lpLockedUSD") or 0 for m in report.get("markets") or [])
    return locked / total * 100


def creator_pct(report: dict) -> float | None:
    """Percent of the supply the creator wallet still holds."""
    supply = dig(report, "token", "supply")
    balance = report.get("creatorBalance")
    if not supply or balance is None:
        return None
    return balance / supply * 100

def creator_tokens(report: dict) -> list[schemas.CreatorToken] | None:
    """The creator's other tokens, newest first, or None when RugCheck names no
    creator. RugCheck sends null rather than [] for a creator with no others."""
    if not report.get("creator"):
        return None
    own_mint = report.get("mint")
    return [
        schemas.CreatorToken(mint=token["mint"], market_cap=token.get("marketCap"), created_at=token.get("createdAt"))
        for token in report.get("creatorTokens") or []
        if token.get("mint") and token["mint"] != own_mint
    ]


def insider_networks(report: dict) -> tuple[list[schemas.InsiderNetwork], float | None]:
    """RugCheck's groups of transfer-linked wallets, and the share of the supply
    they hold together. No supply means the share is unknown."""
    supply = dig(report, "token", "supply")
    networks = [
        schemas.InsiderNetwork(
            size=network.get("size") or 0,
            pct=network["currentHolding"] / supply * 100 if supply and network.get("currentHolding") is not None else None,
        )
        for network in report.get("insiderNetworks") or []
    ]
    if not supply:
        return networks, None
    return networks, sum(network.pct or 0 for network in networks)


def top_holders(report: dict, count: int = 10) -> list[schemas.Holder]:
    """The biggest holders that are not pools, largest first."""
    known = report.get("knownAccounts") or {}
    holders = []

    for holder in report.get("topHolders") or []:
        label = dig(known, holder.get("owner"), "type")
        if label in POOL_HOLDER_TYPES:
            continue
        holders.append(schemas.Holder(
            owner=holder.get("owner"),
            pct=holder.get("pct") or 0,
            insider=bool(holder.get("insider")),
            label=label,
        ))
        if len(holders) == count:
            break
        
    return holders

def summarize_report(report: dict) -> schemas.SafetyData:
    """Keep only the safety fields the analyzer uses."""
    holders = top_holders(report)
    # No holder list means the top-10 share is unknown, not 0%.
    listed = bool(report.get("topHolders"))
    networks, linked_pct = insider_networks(report)

    return schemas.SafetyData(
        mint=report.get("mint"),
        name=dig(report, "tokenMeta", "name"),
        symbol=dig(report, "tokenMeta", "symbol"),
        mint_authority=report.get("mintAuthority"),
        freeze_authority=report.get("freezeAuthority"),
        mutable_metadata=dig(report, "tokenMeta", "mutable"),
        transfer_fee_pct=dig(report, "transferFee", "pct"),
        lp_locked_pct=lp_locked_pct(report),
        # RugCheck reports 0 when it has indexed no pools yet; that means unknown.
        total_market_liquidity=report.get("totalMarketLiquidity") if report.get("markets") else None,
        total_holders=report.get("totalHolders"),
        top10_pct=sum(h.pct for h in holders) if listed else None,
        top10_insiders=sum(1 for h in holders if h.insider) if listed else None,
        top_holders=holders,
        creator=report.get("creator"),
        creator_pct=creator_pct(report),
        insiders_detected=report.get("graphInsidersDetected"),
        launchpad=dig(report, "launchpad", "name"),
        rugged=report.get("rugged"),
        rugcheck_score=report.get("score_normalised"),
        risks=[
            schemas.Risk(
                name=risk.get("name"),
                level=risk.get("level"),
                description=risk.get("description"),
            )
            for risk in report.get("risks") or []
        ],
        creator_tokens=creator_tokens(report),
        insider_networks=networks,
        linked_wallets_pct=linked_pct,
    )




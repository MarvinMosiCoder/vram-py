from datetime import datetime, timezone

import httpx

from app import schemas
from app.helpers.memecoin.common import dig

SEARCH_URL = "https://api.dexscreener.com/latest/dex/search"
TOKEN_PAIRS_URL = "https://api.dexscreener.com/token-pairs/v1/{chain}/{address}"
TIMEOUT_SECONDS = 10

async def search_pairs(client: httpx.AsyncClient, query: str) -> list[dict]:
    response = await client.get(SEARCH_URL, params={"q": query}, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json().get("pairs") or []

async def fetch_token_pairs(client: httpx.AsyncClient, chain: str, address: str) -> list[dict]:
    """The pairs of one known token, as raw dicts. Capped at 30, like search."""
    url = TOKEN_PAIRS_URL.format(chain=chain, address=address)
    response = await client.get(url, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json() or []

def age_hours(created_ms: int | None) -> float | None:
    if created_ms is None:
        return None
    created = datetime.fromtimestamp(created_ms / 1000, tz=timezone.utc)
    return (datetime.now(timezone.utc) - created).total_seconds() / 3600


def summarize_pair(pair: dict) -> schemas.PoolData:
    return schemas.PoolData(
        chain=pair.get("chainId"),
        dex=pair.get("dexId"),
        name=dig(pair, "baseToken", "name"),
        symbol=dig(pair, "baseToken", "symbol"),
        address=dig(pair, "baseToken", "address"),
        pair_address=pair.get("pairAddress"),
        price_usd=pair.get("priceUsd"),
        liquidity_usd=dig(pair, "liquidity", "usd"),
        volume_24h=dig(pair, "volume", "h24"),
        buys_24h=dig(pair, "txns", "h24", "buys"),
        sells_24h=dig(pair, "txns", "h24", "sells"),
        age_hours=age_hours(pair.get("pairCreatedAt")),
        url=pair.get("url"),
    )

def group_tokens(pairs: list[dict]) -> list[schemas.MarketData]:
    """One entry per token: its deepest pool, plus totals across all its pools."""
    tokens: dict[tuple[str, str], schemas.MarketData] = {}

    for pair in pairs:
        pool = summarize_pair(pair)
        key = (pool.chain, pool.address)
        liquidity = pool.liquidity_usd or 0
        volume = pool.volume_24h or 0

        token = tokens.get(key)
        if token is None:
            tokens[key] = schemas.MarketData(
                **pool.model_dump(),
                total_liquidity_usd=liquidity,
                total_volume_24h=volume,
            )
            continue

        token.pools += 1
        token.total_liquidity_usd += liquidity
        token.total_volume_24h += volume
        if liquidity > (token.liquidity_usd or 0):
            tokens[key] = token.model_copy(update=pool.model_dump())

    # Most traded first. Liquidity is easy to fake: a pool can claim millions
    # and see a few cents of trading a day.
    return sorted(tokens.values(), key=lambda t: t.total_volume_24h, reverse=True)

def token_market(pairs: list[dict], address: str) -> schemas.MarketData | None:
    """The MarketData for ``address``, skipping pairs where it is only the quote token."""
    return next((t for t in group_tokens(pairs) if t.address == address), None)

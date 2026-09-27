"""Solana RPC collector: a wallet's recent transactions and the tokens it gained.

Uses the public mainnet endpoint, which needs no key and rate-limits heavy use.
Enough for watching a handful of wallets every few minutes.
"""
import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from app.helpers.memecoin.rugcheck import retry_wait

RPC_URL = "https://api.mainnet-beta.solana.com"
TIMEOUT_SECONDS = 20
# Newer transaction versions exist; the RPC refuses to return one above this.
MAX_TRANSACTION_VERSION = 1
# What buys are paid in: gaining these is not buying a coin.
QUOTE_MINTS = {
    "So11111111111111111111111111111111111111112",   # wrapped SOL
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",  # USDT
}


class RpcError(Exception):
    """The RPC answered with an error object instead of a result."""


@dataclass
class TokenGain:
    mint: str
    amount: float


async def call(client: httpx.AsyncClient, method: str, params: list):
    """One RPC call. The public endpoint allows about 40 calls of one method per
    10 seconds and answers HTTP 429 beyond that; a 429 is retried once after the
    same wait RugCheck's retry uses."""
    body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    response = await client.post(RPC_URL, json=body, timeout=TIMEOUT_SECONDS)
    if response.status_code == 429:
        await asyncio.sleep(retry_wait(response))
        response = await client.post(RPC_URL, json=body, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    body = response.json()
    if "error" in body:
        raise RpcError(body["error"].get("message", "RPC error"))
    return body["result"]


async def signatures(client: httpx.AsyncClient, address: str, until: str | None, limit: int) -> list[dict]:
    """The wallet's transaction signatures, newest first, stopping before `until`."""
    options = {"limit": limit}
    if until:
        options["until"] = until
    return await call(client, "getSignaturesForAddress", [address, options])


async def transaction(client: httpx.AsyncClient, signature: str) -> dict | None:
    return await call(
        client,
        "getTransaction",
        [signature, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": MAX_TRANSACTION_VERSION}],
    )


def _amount(balance: dict) -> float:
    return float((balance.get("uiTokenAmount") or {}).get("uiAmountString") or 0)


def token_gains(tx: dict, owner: str) -> list[TokenGain]:
    """The tokens whose balance for `owner` went up in this transaction.

    Compares the owner's token balances before and after. A gain in SOL, USDC,
    or USDT is left out: that is the other side of a sale, not a buy.
    """
    meta = tx.get("meta") or {}
    before = {b["mint"]: _amount(b) for b in meta.get("preTokenBalances") or [] if b.get("owner") == owner}
    gains = []
    for balance in meta.get("postTokenBalances") or []:
        if balance.get("owner") != owner or balance["mint"] in QUOTE_MINTS:
            continue
        gained = _amount(balance) - before.get(balance["mint"], 0)
        if gained > 0:
            gains.append(TokenGain(mint=balance["mint"], amount=gained))
    return gains


def block_time(tx: dict) -> datetime | None:
    """When the transaction landed, as naive UTC like the memecoin tables."""
    seconds = tx.get("blockTime")
    return datetime.fromtimestamp(seconds, tz=timezone.utc).replace(tzinfo=None) if seconds else None

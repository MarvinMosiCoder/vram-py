"""Watch wallets for buys (Phase 9): the good_dev and watch lists.

run_check() looks at each watched wallet's transactions since the last check,
stores an alert for every token the wallet gained, and sends it to Telegram
when that is configured. The Watch page's button and the command line below
both call it.

Run from backend/:
    python -m app.helpers.memecoin.watch              check once
    python -m app.helpers.memecoin.watch --every 300  check every 5 minutes
"""
import argparse
import asyncio
import sys
import time
from dataclasses import dataclass
from datetime import datetime

import httpx
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app import models, schemas
from app.core.config import settings
from app.helpers.memecoin import solana_rpc, storage
from app.helpers.memecoin.chains import family_of
from app.helpers.memecoin.common import describe

# Transactions looked at per wallet and check, oldest first. A longer backlog
# carries over to the next check, so nothing is skipped.
MAX_NEW_TRANSACTIONS = 20
# Signatures listed per request; the RPC's own maximum.
SIGNATURE_PAGE = 1000
# A pause between transaction requests: about 30 per 10 seconds, under the
# public RPC's 40 per method. 0.2 seconds drew HTTP 429 in practice.
REQUEST_PAUSE_SECONDS = 0.35
TELEGRAM_URL = "https://api.telegram.org/bot{token}/sendMessage"


@dataclass
class Found:
    """A token the wallet gained in one transaction."""
    signature: str
    mint: str
    amount: float
    block_time: datetime | None


async def scan_wallet(client: httpx.AsyncClient, address: str, last_signature: str | None) -> tuple[str | None, list[Found], int]:
    """The wallet's gains in up to MAX_NEW_TRANSACTIONS transactions after
    last_signature, oldest first.

    Returns the last signature looked at (where the next scan starts), what was
    found, and how many newer transactions still wait. The first scan of a
    wallet only records where to start: its history is not news.
    """
    newer = await solana_rpc.signatures(client, address, until=last_signature, limit=SIGNATURE_PAGE)
    if not newer:
        return last_signature, [], 0
    if last_signature is None:
        return newer[0]["signature"], [], 0

    pending = list(reversed(newer))  # the RPC lists newest first
    batch = pending[:MAX_NEW_TRANSACTIONS]
    found = []
    for entry in batch:
        if entry.get("err"):
            continue  # a failed transaction moved nothing
        tx = await solana_rpc.transaction(client, entry["signature"])
        await asyncio.sleep(REQUEST_PAUSE_SECONDS)
        if tx is None:
            continue
        for gain in solana_rpc.token_gains(tx, address):
            found.append(Found(entry["signature"], gain.mint, gain.amount, solana_rpc.block_time(tx)))
    return batch[-1]["signature"], found, len(pending) - len(batch)


def telegram_enabled() -> bool:
    return bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID)


def alert_text(alert: models.MemecoinAlert) -> str:
    who = alert.wallet_label or ("Good dev" if alert.wallet_list == "good_dev" else "Watched wallet")
    return (
        f"{who} {alert.wallet_address[:4]}…{alert.wallet_address[-4:]} gained {alert.amount:,.0f} of {alert.mint}\n"
        f"https://dexscreener.com/solana/{alert.mint}"
    )


async def send_telegram(client: httpx.AsyncClient, text: str) -> None:
    response = await client.post(
        TELEGRAM_URL.format(token=settings.TELEGRAM_BOT_TOKEN),
        json={"chat_id": settings.TELEGRAM_CHAT_ID, "text": text, "disable_web_page_preview": True},
        timeout=10,
    )
    response.raise_for_status()


async def run_check(db: Session) -> schemas.WatchResult:
    """Scan every watched wallet once. A wallet that fails is reported in errors
    and keeps its place, so the next check retries it."""
    wallets = await run_in_threadpool(storage.watched_wallets, db)
    errors: dict[str, str] = {}
    # Scanning uses the Solana RPC; EVM wallets can sit on the lists (for the
    # blacklist rules) but are not watched yet.
    for wallet in wallets:
        if family_of(wallet.address) == "evm":
            errors[wallet.address] = "EVM wallets are not watched yet; only Solana wallets are scanned"
    targets = [(w.id, w.address, w.last_signature) for w in wallets if family_of(w.address) == "solana"]
    new_alerts: list[models.MemecoinAlert] = []

    async with httpx.AsyncClient() as client:
        for wallet_id, address, last_signature in targets:
            try:
                reached, found, waiting = await scan_wallet(client, address, last_signature)
            except (httpx.HTTPError, solana_rpc.RpcError) as error:
                errors[address] = describe(error)
                continue
            if waiting:
                errors[address] = f"{waiting} more new transactions wait for the next check"
            new_alerts += await run_in_threadpool(storage.record_scan, db, wallet_id, reached, found)

        if new_alerts and telegram_enabled():
            try:
                for alert in new_alerts:
                    await send_telegram(client, alert_text(alert))
            except httpx.HTTPError as error:
                errors["telegram"] = describe(error)

    return schemas.WatchResult(wallets_checked=len(targets), new_alerts=len(new_alerts), errors=errors)


def main() -> None:
    from app.core.database import SessionLocal

    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Check watched wallets for buys.")
    parser.add_argument("--every", type=int, default=0, metavar="SECONDS", help="repeat every SECONDS; 0 checks once")
    args = parser.parse_args()

    while True:
        with SessionLocal() as db:
            result = asyncio.run(run_check(db))
        print(f"{time.strftime('%H:%M:%S')}  {result.wallets_checked} wallets, {result.new_alerts} new alerts")
        for source, reason in result.errors.items():
            print(f"  {source}: {reason}")
        if not args.every:
            break
        time.sleep(args.every)


if __name__ == "__main__":
    main()

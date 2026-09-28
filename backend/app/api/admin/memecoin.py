"""Memecoin analyzer endpoints: search and analyze coins, browse saved reports,
keep wallet lists, keep a trade journal, and watch wallets for buys.

search and analyze call DexScreener and RugCheck live; analyze saves each
freshly fetched report. See docs/vram/memecoin.md for the behavior.
"""
from datetime import datetime, timezone
from typing import Literal

import httpx
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app import schemas
from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.helpers.memecoin import analyzer, dexscreener, storage, watch
from app.helpers.memecoin.chains import ANY_ADDRESS, CHAINS, is_valid_address, normalize
from app.schemas.admin.memecoin import ChainId, WalletList

router = APIRouter(prefix="/memecoin", tags=["memecoin"])


class MarketSnapshot(BaseModel):
    market: schemas.MarketData | None
    fetched_at: datetime


class WalletToken(BaseModel):
    address: str
    name: str | None
    symbol: str | None
    market_cap: float | None
    created_at: datetime | None
    observed_at: datetime
    source: Literal["Saved report", "RugCheck creator history"]
    report_id: int | None


class WalletTokens(BaseModel):
    chain: ChainId
    address: str
    relationship: Literal["creator", "owner"]
    tokens: list[WalletToken]
    total: int
    limit: int
    offset: int
    coverage: Literal["saved_reports"]


@router.get("/wallet-tokens/{chain}/{address}", response_model=WalletTokens)
def wallet_tokens(
    chain: ChainId,
    address: str = Path(pattern=ANY_ADDRESS),
    relationship: Literal["creator", "owner"] = Query(default="creator"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not is_valid_address(CHAINS[chain], address):
        raise HTTPException(status_code=422, detail=f"Not a {CHAINS[chain].name} wallet address")
    if chain == "solana" and relationship == "owner":
        raise HTTPException(status_code=422, detail="Current-owner lookup is available for EVM chains only")
    return storage.wallet_tokens(db, chain, address, relationship, limit, offset)


@router.get("/market/{chain}/{address}", response_model=MarketSnapshot)
async def market_snapshot(
    chain: ChainId,
    address: str = Path(pattern=ANY_ADDRESS),
    current_user=Depends(get_current_user),
):
    """Refresh only market metrics, without saving a report or rerunning safety."""
    if not is_valid_address(CHAINS[chain], address):
        raise HTTPException(status_code=422, detail=f"Not a {CHAINS[chain].name} token address")
    address = normalize(address)
    async with httpx.AsyncClient() as client:
        try:
            pairs = await dexscreener.fetch_token_pairs(client, chain, address)
        except httpx.HTTPError as error:
            raise HTTPException(status_code=502, detail=f"Market refresh failed: {analyzer.describe(error)}") from error
    return MarketSnapshot(market=dexscreener.token_market(pairs, address), fetched_at=datetime.now(timezone.utc))


@router.get("/search", response_model=list[schemas.MarketData])
async def search(
    q: str = Query(min_length=2, max_length=100),
    chain: ChainId | None = Query(default=None),
    current_user=Depends(get_current_user),
):
    """Tokens on the supported chains matching a name or address, most traded
    first. `chain` keeps one chain only."""
    async with httpx.AsyncClient() as client:
        try:
            pairs = await dexscreener.search_pairs(client, q)
        except httpx.HTTPError as error:
            raise HTTPException(
                status_code=502,
                detail=f"DexScreener search failed: {analyzer.describe(error)}",
            ) from error

    wanted = {chain} if chain else set(CHAINS)
    return [token for token in dexscreener.group_tokens(pairs) if token.chain in wanted]


@router.get("/analyze/{chain}/{address}", response_model=schemas.CoinReport)
async def analyze(
    chain: ChainId,
    address: str = Path(pattern=ANY_ADDRESS),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Market data, safety data, and the rule verdict for one token.

    Safety comes from RugCheck on Solana and GoPlus on EVM chains. A source
    that fails is reported in ``errors`` rather than failing the request. The
    report is judged against your blacklist and saved to the history the first
    time it is fetched.
    """
    if not is_valid_address(CHAINS[chain], address):
        raise HTTPException(status_code=422, detail=f"Not a {CHAINS[chain].name} token address")
    # EVM addresses are case-insensitive; one spelling keeps cache and history together.
    address = normalize(address)
    # Database calls block; run them off the event loop that serves requests.
    blacklist = await run_in_threadpool(storage.blacklist, db)
    report = await analyzer.analyze(address, blacklist=blacklist, chain=chain)
    await run_in_threadpool(storage.save_report, db, report, current_user.id)
    return report


# --- Saved reports -------------------------------------------------------------

class ClearHistoryRequest(BaseModel):
    confirm: Literal["clear_all_reports"]


class ClearHistoryResult(BaseModel):
    deleted: int


@router.delete("/reports", response_model=ClearHistoryResult)
def clear_history(
    confirmation: ClearHistoryRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1)),
):
    """Administrator-only deletion of shared history, never journal entries."""
    deleted = storage.clear_reports(db)
    analyzer.clear_cache()
    return ClearHistoryResult(deleted=deleted)

@router.get("/reports", response_model=list[schemas.ReportSummary])
def list_reports(
    address: str | None = Query(default=None, pattern=ANY_ADDRESS),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Saved reports, newest first, optionally for one address."""
    return storage.list_reports(db, address, limit, offset)


@router.get("/reports/{report_id}", response_model=schemas.SavedReport)
def get_report(report_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    row = storage.get_report(db, report_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return row


@router.delete("/reports/{report_id}", status_code=204)
def delete_report(
    report_id: int = Path(gt=0),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(1)),
):
    if not storage.delete_report(db, report_id):
        raise HTTPException(status_code=404, detail="Report not found")
    analyzer.clear_cache()
    return Response(status_code=204)


# --- Wallet lists --------------------------------------------------------------

@router.get("/wallets", response_model=list[schemas.WalletOut])
def list_wallets(
    wallet_list: WalletList | None = Query(default=None, alias="list"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Wallets on both lists, or on one with ?list=blacklist or ?list=good_dev."""
    return storage.list_wallets(db, wallet_list)


@router.post("/wallets", response_model=schemas.WalletOut, status_code=201)
def add_wallet(wallet: schemas.WalletIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    row = storage.add_wallet(db, wallet, current_user.id)
    if row is None:
        list_name = {"blacklist": "blacklist", "good_dev": "good dev list", "watch": "watch list"}[wallet.list]
        raise HTTPException(status_code=409, detail=f"This wallet is already on the {list_name}")
    if row.list == storage.BLACKLIST:
        # Cached reports were judged against the old blacklist.
        analyzer.clear_cache()
    return row


@router.delete("/wallets/{wallet_id}", status_code=204)
def delete_wallet(wallet_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    row = storage.delete_wallet(db, wallet_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Wallet not found")
    if row.list == storage.BLACKLIST:
        analyzer.clear_cache()
    return Response(status_code=204)


# --- Trade journal -------------------------------------------------------------

@router.get("/trades", response_model=list[schemas.TradeOut])
def list_trades(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Your trades, newest entry first."""
    return storage.list_trades(db, current_user.id)


@router.post("/trades", response_model=schemas.TradeOut, status_code=201)
def add_trade(trade: schemas.TradeIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if trade.report_id is not None and storage.get_report(db, trade.report_id) is None:
        raise HTTPException(status_code=422, detail="Report not found")
    return storage.add_trade(db, trade, current_user.id)


@router.patch("/trades/{trade_id}", response_model=schemas.TradeOut)
def update_trade(
    trade_id: int,
    changes: schemas.TradeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Change a trade. Closing it sends exit_price and exit_reason together."""
    row = storage.get_trade(db, current_user.id, trade_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Trade not found")
    storage.update_trade(db, row, changes)
    if not storage.exit_is_consistent(row):
        db.rollback()
        raise HTTPException(status_code=422, detail="A closed trade needs both an exit price and an exit reason")
    db.commit()
    db.refresh(row)
    return row


@router.delete("/trades/{trade_id}", status_code=204)
def delete_trade(trade_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    row = storage.get_trade(db, current_user.id, trade_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Trade not found")
    storage.delete_trade(db, row)
    return Response(status_code=204)


# --- Watching wallets ------------------------------------------------------------

@router.get("/watch", response_model=schemas.WatchStatus)
def watch_status(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """How many wallets are watched, whether Telegram is set up, and the last check."""
    wallets, last_checked_at = storage.watch_status(db)
    return schemas.WatchStatus(wallets=wallets, telegram=watch.telegram_enabled(), last_checked_at=last_checked_at)


@router.post("/watch/check", response_model=schemas.WatchResult)
async def check_watched_wallets(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Scan the watched wallets now. Takes a few seconds per wallet with new activity."""
    return await watch.run_check(db)


@router.get("/alerts", response_model=schemas.AlertList)
def list_alerts(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """The newest alerts, and how many are unseen."""
    return schemas.AlertList(alerts=storage.list_alerts(db, limit), unseen=storage.unseen_alerts(db))


@router.post("/alerts/seen", status_code=204)
def mark_alerts_seen(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    storage.mark_alerts_seen(db)
    return Response(status_code=204)

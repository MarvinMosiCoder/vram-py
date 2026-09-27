"""Database side of the memecoin analyzer: saved reports, wallet lists, journal.

The analyzer and the rules never touch the database. The routes read what the
rules need (the blacklist) from here and pass it in, and hand finished reports
back here to be saved. See docs/vram/memecoin.md#storage.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app import models, schemas
from app.helpers.memecoin.chains import normalize

BLACKLIST = "blacklist"


def utc_now() -> datetime:
    """Naive UTC, the form the memecoin tables store."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def naive_utc(value: datetime) -> datetime:
    """An aware time converted to naive UTC; a naive time is taken as UTC."""
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


# --- Reports -----------------------------------------------------------------

def save_report(db: Session, report: schemas.CoinReport, user_id: int | None) -> models.MemecoinReport | None:
    """Save a report unless it is saved already.

    A cached report comes back with the checked_at of the request that fetched
    it, so repeat requests within the cache time store it only once.
    """
    checked_at = naive_utc(report.checked_at)
    exists = (
        db.query(models.MemecoinReport.id)
        .filter_by(address=report.address, checked_at=checked_at)
        .first()
    )
    if exists:
        return None

    identity = report.market or report.safety
    row = models.MemecoinReport(
        address=report.address,
        chain=report.chain,
        symbol=identity.symbol if identity else None,
        name=identity.name if identity else None,
        verdict=report.assessment.verdict,
        score=report.assessment.score,
        report=report.model_dump(mode="json"),
        checked_at=checked_at,
        adm_user_id=user_id,
        created_at=utc_now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_reports(db: Session, address: str | None, limit: int, offset: int) -> list[models.MemecoinReport]:
    query = db.query(models.MemecoinReport)
    if address:
        query = query.filter_by(address=normalize(address))
    return (
        query.order_by(models.MemecoinReport.checked_at.desc(), models.MemecoinReport.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_report(db: Session, report_id: int) -> models.MemecoinReport | None:
    return db.get(models.MemecoinReport, report_id)


# --- Wallet lists --------------------------------------------------------------

def blacklist(db: Session) -> frozenset[str]:
    rows = db.query(models.MemecoinWallet.address).filter_by(list=BLACKLIST).all()
    return frozenset(address for (address,) in rows)


def list_wallets(db: Session, wallet_list: str | None) -> list[models.MemecoinWallet]:
    query = db.query(models.MemecoinWallet)
    if wallet_list:
        query = query.filter_by(list=wallet_list)
    return query.order_by(models.MemecoinWallet.created_at.desc(), models.MemecoinWallet.id.desc()).all()


def add_wallet(db: Session, wallet: schemas.WalletIn, user_id: int) -> models.MemecoinWallet | None:
    """Add a wallet to a list. Returns None when it is on that list already.
    EVM addresses are stored in lower case, the form the rules compare."""
    address = normalize(wallet.address)
    exists = db.query(models.MemecoinWallet.id).filter_by(list=wallet.list, address=address).first()
    if exists:
        return None
    row = models.MemecoinWallet(**wallet.model_dump(exclude={"address"}), address=address, adm_user_id=user_id, created_at=utc_now())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_wallet(db: Session, wallet_id: int) -> models.MemecoinWallet | None:
    """Delete a wallet and return it, or None when there is no such wallet."""
    row = db.get(models.MemecoinWallet, wallet_id)
    if row is None:
        return None
    db.delete(row)
    db.commit()
    return row


# --- Trade journal -------------------------------------------------------------
# Trades belong to one user: every lookup filters by adm_user_id, so another
# user's trade id behaves as if it did not exist.

def list_trades(db: Session, user_id: int) -> list[models.MemecoinTrade]:
    return (
        db.query(models.MemecoinTrade)
        .filter_by(adm_user_id=user_id)
        .order_by(models.MemecoinTrade.entered_at.desc(), models.MemecoinTrade.id.desc())
        .all()
    )


def get_trade(db: Session, user_id: int, trade_id: int) -> models.MemecoinTrade | None:
    return db.query(models.MemecoinTrade).filter_by(id=trade_id, adm_user_id=user_id).first()


def add_trade(db: Session, trade: schemas.TradeIn, user_id: int) -> models.MemecoinTrade:
    now = utc_now()
    row = models.MemecoinTrade(
        **trade.model_dump(exclude={"entered_at", "address"}),
        address=normalize(trade.address),
        entered_at=naive_utc(trade.entered_at) if trade.entered_at else now,
        adm_user_id=user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_trade(db: Session, row: models.MemecoinTrade, changes: schemas.TradeUpdate) -> models.MemecoinTrade:
    """Apply the fields that were sent. The caller checks the result with
    exit_is_consistent before this is committed."""
    for name, value in changes.model_dump(exclude_unset=True).items():
        if isinstance(value, datetime):
            value = naive_utc(value)
        setattr(row, name, value)
    if row.exit_price is not None and row.exited_at is None:
        row.exited_at = utc_now()
    row.updated_at = utc_now()
    return row


def exit_is_consistent(row: models.MemecoinTrade) -> bool:
    """A closed trade needs both an exit price and the reason for selling."""
    return (row.exit_price is None) == (row.exit_reason is None)


def delete_trade(db: Session, row: models.MemecoinTrade) -> None:
    db.delete(row)
    db.commit()


# --- Watching wallets (Phase 9) -------------------------------------------------
# Wallet lists and alerts are shared by all users, like the blacklist.

WATCHED_LISTS = ("good_dev", "watch")


def watched_wallets(db: Session) -> list[models.MemecoinWallet]:
    """Every wallet on a watched list, EVM ones included; watch.run_check skips
    those, since only Solana wallets can be scanned so far."""
    return (
        db.query(models.MemecoinWallet)
        .filter(models.MemecoinWallet.list.in_(WATCHED_LISTS))
        .order_by(models.MemecoinWallet.id)
        .all()
    )


def watch_status(db: Session) -> tuple[int, datetime | None]:
    """How many wallets are scanned (Solana only so far), and when any of them
    was last checked."""
    wallets = [wallet for wallet in watched_wallets(db) if not wallet.address.startswith("0x")]
    checked = [wallet.last_checked_at for wallet in wallets if wallet.last_checked_at]
    return len(wallets), max(checked, default=None)


def record_scan(db: Session, wallet_id: int, newest_signature: str | None, found: list) -> list[models.MemecoinAlert]:
    """Store one wallet's scan: new alerts, and where the next scan starts.

    `found` holds watch.Found items. An alert already stored for the same
    transaction, wallet, and token is skipped, so a repeated scan adds nothing.
    """
    wallet = db.get(models.MemecoinWallet, wallet_id)
    if wallet is None:
        return []
    now = utc_now()
    alerts = []
    for item in found:
        exists = (
            db.query(models.MemecoinAlert.id)
            .filter_by(signature=item.signature, wallet_address=wallet.address, mint=item.mint)
            .first()
        )
        if exists:
            continue
        alert = models.MemecoinAlert(
            wallet_id=wallet.id,
            wallet_address=wallet.address,
            wallet_list=wallet.list,
            wallet_label=wallet.label,
            mint=item.mint,
            amount=item.amount,
            signature=item.signature,
            block_time=item.block_time,
            seen=False,
            created_at=now,
        )
        db.add(alert)
        alerts.append(alert)
    if newest_signature:
        wallet.last_signature = newest_signature
    wallet.last_checked_at = now
    db.commit()
    for alert in alerts:
        db.refresh(alert)
    return alerts


def list_alerts(db: Session, limit: int) -> list[models.MemecoinAlert]:
    return (
        db.query(models.MemecoinAlert)
        .order_by(models.MemecoinAlert.created_at.desc(), models.MemecoinAlert.id.desc())
        .limit(limit)
        .all()
    )


def unseen_alerts(db: Session) -> int:
    return db.query(models.MemecoinAlert).filter_by(seen=False).count()


def mark_alerts_seen(db: Session) -> None:
    db.query(models.MemecoinAlert).filter_by(seen=False).update({"seen": True})
    db.commit()

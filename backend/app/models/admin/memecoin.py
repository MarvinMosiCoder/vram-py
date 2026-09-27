"""Memecoin analyzer storage: saved reports, wallet lists, and the trade journal.

Times are naive UTC, since report times come from the API in UTC; the
schemas mark them as UTC on the way out. See docs/vram/memecoin.md#storage.
"""
from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import false as sa_false

from app.core.database import Base


class MemecoinReport(Base):
    """One analyze result, saved when its sources were freshly fetched."""
    __tablename__ = "memecoin_reports"

    id = Column(Integer, primary_key=True, index=True)
    address = Column(String(44), nullable=False, index=True)
    chain = Column(String(16), nullable=False)
    symbol = Column(String(64), nullable=True)
    name = Column(String(255), nullable=True)
    verdict = Column(String(16), nullable=False)
    score = Column(Integer, nullable=False)
    # The full CoinReport as JSON, so a saved report renders like a live one.
    report = Column(JSON, nullable=False)
    checked_at = Column(DateTime, nullable=False, index=True)
    adm_user_id = Column(Integer, ForeignKey("adm_users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False)


class MemecoinWallet(Base):
    """A wallet on one of the lists: "blacklist" (scam devs, bundle wallets)
    feeds the rules; "good_dev" and "watch" wallets are watched for buys."""
    __tablename__ = "memecoin_wallets"
    __table_args__ = (UniqueConstraint("list", "address", name="uq_memecoin_wallets_list_address"),)

    id = Column(Integer, primary_key=True, index=True)
    address = Column(String(44), nullable=False, index=True)
    list = Column(String(16), nullable=False)
    label = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
    adm_user_id = Column(Integer, ForeignKey("adm_users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False)
    # Watching (Phase 9): the newest transaction already looked at, and when.
    last_signature = Column(String(100), nullable=True)
    last_checked_at = Column(DateTime, nullable=True)


class MemecoinTrade(Base):
    """One journal entry: why a coin was bought and, once closed, why it was sold."""
    __tablename__ = "memecoin_trades"

    id = Column(Integer, primary_key=True, index=True)
    adm_user_id = Column(Integer, ForeignKey("adm_users.id"), nullable=False, index=True)
    chain = Column(String(16), nullable=False, default="solana", server_default="solana")
    address = Column(String(44), nullable=False, index=True)
    symbol = Column(String(64), nullable=True)
    # USD per token. Memecoin prices go down to 1e-9, which Float holds exactly enough.
    entry_price = Column(Float, nullable=False)
    amount_usd = Column(Float, nullable=True)
    entry_reason = Column(Text, nullable=False)
    entered_at = Column(DateTime, nullable=False)
    exit_price = Column(Float, nullable=True)
    exit_reason = Column(Text, nullable=True)
    exited_at = Column(DateTime, nullable=True)
    # The report the trade was entered from, if any.
    report_id = Column(Integer, ForeignKey("memecoin_reports.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class MemecoinAlert(Base):
    """A watched wallet gained a token in one transaction."""
    __tablename__ = "memecoin_alerts"
    __table_args__ = (UniqueConstraint("signature", "wallet_address", "mint", name="uq_memecoin_alerts_signature_wallet_mint"),)

    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("memecoin_wallets.id", ondelete="SET NULL"), nullable=True, index=True)
    # Copied from the wallet, so the alert still reads right if the wallet is deleted.
    wallet_address = Column(String(44), nullable=False)
    wallet_list = Column(String(16), nullable=False)
    wallet_label = Column(String(100), nullable=True)
    mint = Column(String(44), nullable=False)
    amount = Column(Float, nullable=False)
    signature = Column(String(100), nullable=False)
    block_time = Column(DateTime, nullable=True)
    seen = Column(Boolean, nullable=False, default=False, server_default=sa_false())
    created_at = Column(DateTime, nullable=False, index=True)

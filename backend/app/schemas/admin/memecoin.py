"""Shapes for the memecoin analyzer: what the collectors return and the API sends."""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel

class PoolData(BaseModel):
    """One trading pool from DexScreener."""
    chain: str
    address: str
    dex: str | None = None
    name: str | None = None
    symbol: str | None = None
    pair_address: str | None = None
    price_usd: float | None = None
    liquidity_usd: float | None = None
    volume_24h: float | None = None
    buys_24h: int | None = None
    sells_24h: int | None = None
    age_hours: float | None = None
    url: str | None = None


class MarketData(PoolData):
    """One token: its deepest pool's fields, plus totals across all its pools."""
    pools: int = 1
    total_liquidity_usd: float = 0
    total_volume_24h: float = 0


class Holder(BaseModel):
    owner: str | None = None
    pct: float = 0
    insider: bool = False
    label: str | None = None


class Risk(BaseModel):
    name: str
    level: str | None = None
    description: str | None = None


class SafetyData(BaseModel):
    """RugCheck's on-chain safety facts for one Solana mint."""
    mint: str
    name: str | None = None
    symbol: str | None = None
    mint_authority: str | None = None
    freeze_authority: str | None = None
    mutable_metadata: bool | None = None
    transfer_fee_pct: float | None = None
    lp_locked_pct: float | None = None
    total_market_liquidity: float | None = None
    total_holders: int | None = None
    top10_pct: float = 0
    top10_insiders: int = 0
    top_holders: list[Holder] = []
    creator: str | None = None
    creator_pct: float | None = None
    insiders_detected: int | None = None
    launchpad: str | None = None
    rugged: bool = False
    rugcheck_score: int | None = None
    risks: list[Risk] = []

class Finding(BaseModel):
    """One rule that flagged the coin."""
    rule: str
    severity: Literal["fail", "warn"]
    message: str

class Assessment(BaseModel):
    """The rule engine's result for one coin."""
    score: int
    verdict: Literal["Avoid", "High risk", "Watch"]
    findings: list[Finding] = []
    unchecked: list[str] = []

class CoinReport(BaseModel):
    """Everything known about one coin: the analyze endpoint's response."""
    address: str
    checked_at: datetime
    market: MarketData | None = None
    safety: SafetyData | None = None
    assessment: Assessment
    # Source name -> why it failed, e.g. {"rugcheck": "ConnectTimeout"}.
    errors: dict[str, str] = {}

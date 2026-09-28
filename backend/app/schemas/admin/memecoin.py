"""Shapes for the memecoin analyzer: what the collectors return and the API sends."""
from datetime import datetime, timezone
from typing import Annotated, Literal
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, computed_field, field_validator

from app.helpers.memecoin.chains import ADDRESS_PATTERNS, ANY_ADDRESS

# Solana addresses are base58: 32-44 characters, without 0, O, I, or l.
SOLANA_ADDRESS = ADDRESS_PATTERNS["solana"]
# The chains in app/helpers/memecoin/chains.py; a test keeps the two in step.
ChainId = Literal["solana", "ethereum", "bsc", "base", "polygon", "arbitrum", "robinhood"]

class Social(BaseModel):
    """A link DexScreener lists for a token, such as its X or Telegram."""
    type: str | None = None
    url: str


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
    market_cap: float | None = None
    fdv: float | None = None
    volume_1h: float | None = None
    volume_5m: float | None = None
    buys_5m: int | None = None
    sells_5m: int | None = None
    price_change_5m: float | None = None
    price_change_1h: float | None = None
    buys_24h: int | None = None
    sells_24h: int | None = None
    age_hours: float | None = None
    url: str | None = None
    websites: list[str] = []
    socials: list[Social] = []


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


class CreatorToken(BaseModel):
    """Another token the same creator launched, as RugCheck lists it."""
    mint: str
    market_cap: float | None = None
    created_at: datetime | None = None


class InsiderNetwork(BaseModel):
    """Wallets RugCheck links by transfers, which often means one buyer split
    across wallets (a bundle)."""
    size: int = 0
    # Share of the supply the linked wallets hold now.
    pct: float | None = None


class SafetyData(BaseModel):
    """On-chain safety facts for one token: from RugCheck on Solana, from
    GoPlus on EVM chains. Fields one source lacks stay None, and the rules that
    need them only run for the chains that have them."""
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
    # None when RugCheck lists no holders; 0 when every listed holder is a pool.
    top10_pct: float | None = None
    top10_insiders: int | None = None
    top_holders: list[Holder] = []
    creator: str | None = None
    creator_pct: float | None = None
    insiders_detected: int | None = None
    launchpad: str | None = None
    rugged: bool = False
    rugcheck_score: int | None = None
    risks: list[Risk] = []
    # The creator's other tokens, newest first; None when the creator is unknown.
    creator_tokens: list[CreatorToken] | None = None
    insider_networks: list[InsiderNetwork] = []
    # Share of the supply all linked wallets hold together; None without a supply.
    linked_wallets_pct: float | None = None
    # EVM contract checks from GoPlus. None means GoPlus could not tell.
    honeypot: bool | None = None
    buy_tax_pct: float | None = None
    sell_tax_pct: float | None = None
    open_source: bool | None = None
    proxy: bool | None = None
    owner: str | None = None
    owner_renounced: bool | None = None
    # Owner powers count only while someone holds the ownership.
    owner_can_mint: bool | None = None
    owner_can_change_balances: bool | None = None
    hidden_owner: bool | None = None
    can_reclaim_ownership: bool | None = None
    transfers_pausable: bool | None = None
    can_blacklist: bool | None = None
    creator_made_honeypots: bool | None = None


class WebData(BaseModel):
    """The coin's website, checked with RDAP (domain age) and the Wayback Machine."""
    website: str | None = None
    domain: str | None = None
    # On a shared host such as vercel.app or x.com, whose age says nothing about the coin.
    hosted: bool = False
    domain_registered_at: datetime | None = None
    domain_age_days: float | None = None
    wayback_first_at: datetime | None = None
    # Why the Wayback lookup failed. It is informational, so it is not in errors.
    wayback_error: str | None = None

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
    chain: ChainId = "solana"
    address: str
    checked_at: datetime
    market: MarketData | None = None
    safety: SafetyData | None = None
    web: WebData | None = None
    assessment: Assessment
    # Source name -> why it failed, e.g. {"rugcheck": "ConnectTimeout"}.
    errors: dict[str, str] = {}


# --- Storage (Phase 6) -------------------------------------------------------

def _assume_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


# The memecoin tables store naive UTC; this marks it as UTC in the JSON, so a
# browser does not read it as local time.
UtcDatetime = Annotated[datetime, AfterValidator(_assume_utc)]
# "watch" holds traders and influencers to follow; Phase 9 alerts on buys by
# watch and good_dev wallets.
WalletList = Literal["blacklist", "good_dev", "watch"]


class ReportSummary(BaseModel):
    """One saved report in the history list."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    address: str
    chain: ChainId
    symbol: str | None = None
    name: str | None = None
    verdict: Literal["Avoid", "High risk", "Watch"]
    score: int
    checked_at: UtcDatetime


class SavedReport(ReportSummary):
    report: CoinReport


class WalletIn(BaseModel):
    # Solana or EVM; EVM addresses are stored in lower case.
    address: str = Field(pattern=ANY_ADDRESS)
    list: WalletList
    label: str | None = Field(default=None, max_length=100)
    note: str | None = Field(default=None, max_length=1000)


class WalletOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    address: str
    list: WalletList
    label: str | None = None
    note: str | None = None
    created_at: UtcDatetime
    last_checked_at: UtcDatetime | None = None


class TradeIn(BaseModel):
    chain: ChainId = "solana"
    address: str = Field(pattern=ANY_ADDRESS)
    symbol: str | None = Field(default=None, max_length=64)
    entry_price: float = Field(gt=0)
    amount_usd: float | None = Field(default=None, gt=0)
    entry_reason: str = Field(min_length=1, max_length=2000)
    # Defaults to now.
    entered_at: datetime | None = None
    report_id: int | None = None


class TradeUpdate(BaseModel):
    """Only the fields sent are changed. Closing a trade sends exit_price and
    exit_reason; the route rejects a trade left with one and not the other."""
    entry_price: float | None = Field(default=None, gt=0)
    amount_usd: float | None = Field(default=None, gt=0)
    entry_reason: str | None = Field(default=None, min_length=1, max_length=2000)
    exit_price: float | None = Field(default=None, gt=0)
    exit_reason: str | None = Field(default=None, min_length=1, max_length=2000)
    exited_at: datetime | None = None

    @field_validator("entry_price", "entry_reason")
    @classmethod
    def required_once_set(cls, value):
        # Runs only for fields that were sent: these may change, not be cleared.
        if value is None:
            raise ValueError("cannot be cleared")
        return value


class TradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    chain: ChainId
    address: str
    symbol: str | None = None
    entry_price: float
    amount_usd: float | None = None
    entry_reason: str
    entered_at: UtcDatetime
    exit_price: float | None = None
    exit_reason: str | None = None
    exited_at: UtcDatetime | None = None
    report_id: int | None = None
    created_at: UtcDatetime
    updated_at: UtcDatetime

    @computed_field
    @property
    def pnl_pct(self) -> float | None:
        """Profit or loss in percent once closed: +100 means the price doubled."""
        if self.exit_price is None:
            return None
        return (self.exit_price / self.entry_price - 1) * 100


# --- Watching wallets (Phase 9) ----------------------------------------------

class AlertOut(BaseModel):
    """A watched wallet gained a token: usually a buy, or a launch by a dev."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    wallet_address: str
    wallet_list: WalletList
    wallet_label: str | None = None
    mint: str
    amount: float
    signature: str
    block_time: UtcDatetime | None = None
    seen: bool
    created_at: UtcDatetime


class AlertList(BaseModel):
    alerts: list[AlertOut]
    unseen: int


class WatchStatus(BaseModel):
    wallets: int
    telegram: bool
    last_checked_at: UtcDatetime | None = None


class WatchResult(BaseModel):
    wallets_checked: int
    new_alerts: int
    # Wallet address, or "telegram", -> why it failed.
    errors: dict[str, str] = {}

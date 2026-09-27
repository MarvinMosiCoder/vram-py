"""Rule engine: objective red flags, written as data.

Each rule's check returns True (red flag), False (fine), or None (the data it
needs is missing). None is reported as unchecked, never as a pass: a RugCheck
outage must not make a coin look safe.
"""
from dataclasses import dataclass, field
from typing import Any, Callable, Literal

from app import schemas

Severity = Literal["fail", "warn"]

# A coin whose main pool is at least this old is judged as established.
ESTABLISHED_AFTER_HOURS = 30 * 24
YOUNG_PAIR_HOURS = 24
MIN_LIQUIDITY_USD = 1_000
THIN_LIQUIDITY_USD = 10_000
MIN_LP_LOCKED_PCT = 90
MAX_TOP10_PCT = 30
LOW_VOLUME_USD = 1_000
FEW_HOLDERS = 100
MAX_CREATOR_PCT = 5
# RugCheck's own risk name for a creator whose earlier tokens were rugged.
CREATOR_RUGGED_RISK = "Creator history of rugged tokens"
# Creator history (Phase 7): a creator with this many other tokens is a mass
# launcher, and a token worth less than this is taken as dead.
MANY_LAUNCHES = 5
DEAD_MARKET_CAP_USD = 10_000
DEAD_SHARE = 0.8
# Transfer-linked wallets holding this much together can dump as one.
MAX_LINKED_WALLETS_PCT = 10
# Website (Phase 8): a domain younger than this was registered for the launch.
NEW_DOMAIN_DAYS = 30
# EVM (GoPlus): a sell tax above this keeps most of what a seller gets.
MAX_SELL_TAX_PCT = 10
# Risk points per finding; the score is their sum, capped at 100.
SEVERITY_POINTS = {"fail": 40, "warn": 10}
HIGH_RISK_SCORE = 40


@dataclass
class Evidence:
    """Everything the rules can look at. A source that failed is None."""
    market: schemas.MarketData | None
    safety: schemas.SafetyData | None
    # Wallets on your blacklist (scam devs, bundle wallets), from the database.
    blacklist: frozenset[str] = field(default_factory=frozenset)
    # The website's checks. None when DexScreener failed.
    web: schemas.WebData | None = None
    # "solana" or "evm": which rules apply.
    family: str = "solana"

    @property
    def established(self) -> bool:
        """Old enough for the relaxed rules. Unknown age counts as young."""
        age = self.market.age_hours if self.market else None
        return age is not None and age >= ESTABLISHED_AFTER_HOURS

    @property
    def liquidity_usd(self) -> float | None:
        """RugCheck's total when present: it covers every pool, while DexScreener
        stops at 30 pools and reports none for pump.fun bonding curves."""
        if self.safety and self.safety.total_market_liquidity is not None:
            return self.safety.total_market_liquidity
        # DexScreener's totals count a pool with no liquidity figure as 0, so
        # fall back only when the main pool reported one.
        if self.market and self.market.liquidity_usd is not None:
            return self.market.total_liquidity_usd
        return None


ALL_CHAINS = frozenset({"solana", "evm"})
SOLANA = frozenset({"solana"})
EVM = frozenset({"evm"})


@dataclass(frozen=True)
class Rule:
    name: str
    severity: Severity
    message: str
    check: Callable[[Evidence], bool | None]
    # Severity for established coins, when it differs.
    established_severity: Severity | None = None
    # The chain families the rule applies to. On others it is skipped, neither
    # flagged nor unchecked: RugCheck's creator history has no EVM counterpart.
    families: frozenset[str] = ALL_CHAINS


def on_safety(test: Callable[[schemas.SafetyData], bool]) -> Callable[[Evidence], bool | None]:
    """Wrap a test that needs RugCheck data: without it the rule is unchecked."""
    return lambda e: None if e.safety is None else test(e.safety)


def on_safety_value(field: str, test: Callable[[Any], bool]) -> Callable[[Evidence], bool | None]:
    """Wrap a test of one RugCheck field: a missing field is unchecked, like a
    missing source, so an LP lock that could not be measured never passes."""
    def check(e: Evidence) -> bool | None:
        value = None if e.safety is None else getattr(e.safety, field)
        return None if value is None else test(value)
    return check


def creator_blacklisted(e: Evidence) -> bool | None:
    # An empty blacklist cannot match anyone, whatever the creator is.
    if not e.blacklist:
        return False
    if e.safety is None or e.safety.creator is None:
        return None
    return e.safety.creator in e.blacklist


def holder_blacklisted(e: Evidence) -> bool | None:
    if not e.blacklist:
        return False
    if e.safety is None or e.safety.top10_pct is None:
        return None
    return any(holder.owner in e.blacklist for holder in e.safety.top_holders)


def mostly_dead(tokens: list[schemas.CreatorToken]) -> bool:
    """At least MANY_LAUNCHES other tokens, and most of them worth almost nothing.
    A token with no market cap is not counted as dead."""
    dead = sum(1 for token in tokens if token.market_cap is not None and token.market_cap < DEAD_MARKET_CAP_USD)
    return len(tokens) >= MANY_LAUNCHES and dead >= DEAD_SHARE * len(tokens)


def new_domain(e: Evidence) -> bool | None:
    if e.market is None:
        return None
    # No website at all is no_socials' concern; a shared host has no age of its own.
    if not e.market.websites or (e.web is not None and e.web.hosted):
        return False
    if e.web is None or e.web.domain_age_days is None:
        return None
    return e.web.domain_age_days < NEW_DOMAIN_DAYS


def on_market(test: Callable[[schemas.MarketData], bool]) -> Callable[[Evidence], bool | None]:
    """Wrap a test that needs DexScreener data: without it the rule is unchecked."""
    return lambda e: None if e.market is None else test(e.market)


def on_liquidity(test: Callable[[float], bool]) -> Callable[[Evidence], bool | None]:
    return lambda e: None if e.liquidity_usd is None else test(e.liquidity_usd)


RULES = [
    Rule(
        name="mint_authority",
        severity="fail",
        message="The dev can still mint new tokens",
        check=on_safety(lambda s: s.mint_authority is not None),
        families=SOLANA,
    ),
    Rule(
        name="freeze_authority",
        severity="fail",
        message="The dev can freeze holders' tokens so they cannot sell",
        check=on_safety(lambda s: s.freeze_authority is not None),
        families=SOLANA,
    ),
    Rule(
        name="rugged",
        severity="fail",
        message="RugCheck marks this token as rugged",
        check=on_safety(lambda s: s.rugged),
        families=SOLANA,
    ),
    Rule(
        name="creator_rugged_before",
        severity="fail",
        message="RugCheck says this creator has rugged tokens before",
        check=on_safety(lambda s: any(risk.name == CREATOR_RUGGED_RISK for risk in s.risks)),
        families=SOLANA,
    ),
    Rule(
        name="liquidity_too_low",
        severity="fail",
        message=f"Less than ${MIN_LIQUIDITY_USD:,} of liquidity: selling may be impossible",
        check=on_liquidity(lambda usd: usd < MIN_LIQUIDITY_USD),
    ),
    Rule(
        name="lp_unlocked",
        severity="fail",
        established_severity="warn",
        message=f"Less than {MIN_LP_LOCKED_PCT}% of liquidity is locked or burned",
        check=on_safety_value("lp_locked_pct", lambda pct: pct < MIN_LP_LOCKED_PCT),
    ),
    Rule(
        name="top10_concentrated",
        severity="fail",
        established_severity="warn",
        message=f"The top 10 holders own more than {MAX_TOP10_PCT}% (pools excluded)",
        check=on_safety_value("top10_pct", lambda pct: pct > MAX_TOP10_PCT),
    ),
    Rule(
        name="thin_liquidity",
        severity="warn",
        message=f"Less than ${THIN_LIQUIDITY_USD:,} of liquidity",
        check=on_liquidity(lambda usd: MIN_LIQUIDITY_USD <= usd < THIN_LIQUIDITY_USD),
    ),
    Rule(
        name="young_pair",
        severity="warn",
        message=f"The main pool is less than {YOUNG_PAIR_HOURS} hours old",
        check=on_market(lambda m: m.age_hours is not None and m.age_hours < YOUNG_PAIR_HOURS),
    ),
    Rule(
        name="low_volume",
        severity="warn",
        message=f"Less than ${LOW_VOLUME_USD:,} traded in 24 hours",
        check=on_market(lambda m: m.total_volume_24h < LOW_VOLUME_USD),
    ),
    Rule(
        name="few_holders",
        severity="warn",
        message=f"Fewer than {FEW_HOLDERS} holders",
        check=on_safety_value("total_holders", lambda count: count < FEW_HOLDERS),
    ),
    Rule(
        name="creator_holds_supply",
        severity="warn",
        message=f"The creator still holds more than {MAX_CREATOR_PCT}% of the supply",
        check=on_safety_value("creator_pct", lambda pct: pct > MAX_CREATOR_PCT),
    ),
    Rule(
        name="insiders_in_top10",
        severity="warn",
        message="RugCheck links some top-10 holders to each other (insiders)",
        check=on_safety_value("top10_insiders", lambda count: count > 0),
        families=SOLANA,
    ),
    Rule(
        name="transfer_fee",
        severity="warn",
        message="Every transfer pays a fee to the token's authority",
        check=on_safety_value("transfer_fee_pct", lambda pct: pct > 0),
    ),
    Rule(
        name="mutable_metadata",
        severity="warn",
        message="The owner can change the token's name, symbol, and image",
        check=on_safety_value("mutable_metadata", lambda mutable: mutable),
        families=SOLANA,
    ),
    Rule(
        name="creator_blacklisted",
        severity="fail",
        message="The creator wallet is on your blacklist",
        check=creator_blacklisted,
    ),
    Rule(
        name="holder_blacklisted",
        severity="warn",
        message="A top-10 holder is on your blacklist (for example a bundle wallet)",
        check=holder_blacklisted,
    ),
    Rule(
        name="creator_dead_tokens",
        severity="fail",
        message=f"The creator launched {MANY_LAUNCHES}+ other tokens and most are worth under ${DEAD_MARKET_CAP_USD:,}",
        check=on_safety_value("creator_tokens", mostly_dead),
        families=SOLANA,
    ),
    Rule(
        name="creator_many_launches",
        severity="warn",
        message=f"The creator has launched {MANY_LAUNCHES} or more other tokens",
        check=on_safety_value("creator_tokens", lambda tokens: len(tokens) >= MANY_LAUNCHES),
        families=SOLANA,
    ),
    Rule(
        name="linked_wallets_hold",
        severity="warn",
        message=f"Wallets linked by transfers hold {MAX_LINKED_WALLETS_PCT}% or more together (a possible bundle)",
        check=on_safety_value("linked_wallets_pct", lambda pct: pct >= MAX_LINKED_WALLETS_PCT),
        families=SOLANA,
    ),
    Rule(
        name="no_socials",
        severity="warn",
        message="DexScreener lists no website and no social accounts",
        check=on_market(lambda m: not m.websites and not m.socials),
    ),
    Rule(
        name="new_domain",
        severity="warn",
        message=f"The website's domain was registered less than {NEW_DOMAIN_DAYS} days ago",
        check=new_domain,
    ),
    # --- EVM contracts (GoPlus) ---
    Rule(
        name="honeypot",
        severity="fail",
        message="GoPlus flags a honeypot: buyers may not be able to sell",
        check=on_safety_value("honeypot", lambda honeypot: honeypot),
        families=EVM,
    ),
    Rule(
        name="sell_tax_too_high",
        severity="fail",
        message=f"Selling costs a tax above {MAX_SELL_TAX_PCT}%",
        check=on_safety_value("sell_tax_pct", lambda tax: tax > MAX_SELL_TAX_PCT),
        families=EVM,
    ),
    Rule(
        name="not_open_source",
        severity="fail",
        message="The contract's source code is not verified, so nobody can check it",
        check=on_safety_value("open_source", lambda open_source: not open_source),
        families=EVM,
    ),
    Rule(
        name="owner_can_mint",
        severity="fail",
        message="The owner can still mint new tokens",
        check=on_safety_value("owner_can_mint", lambda power: power),
        families=EVM,
    ),
    Rule(
        name="owner_changes_balances",
        severity="fail",
        message="The owner can change holders' balances",
        check=on_safety_value("owner_can_change_balances", lambda power: power),
        families=EVM,
    ),
    Rule(
        name="can_reclaim_ownership",
        severity="fail",
        message="Renounced ownership can be taken back",
        check=on_safety_value("can_reclaim_ownership", lambda power: power),
        families=EVM,
    ),
    Rule(
        name="creator_made_honeypots",
        severity="fail",
        message="GoPlus says this creator has made honeypots before",
        check=on_safety_value("creator_made_honeypots", lambda made: made),
        families=EVM,
    ),
    Rule(
        name="hidden_owner",
        severity="warn",
        message="The contract has a hidden owner",
        check=on_safety_value("hidden_owner", lambda hidden: hidden),
        families=EVM,
    ),
    Rule(
        name="upgradeable_proxy",
        severity="warn",
        message="The contract is an upgradeable proxy: its code can be replaced",
        check=on_safety_value("proxy", lambda proxy: proxy),
        families=EVM,
    ),
    Rule(
        name="transfers_pausable",
        severity="warn",
        message="The owner can pause transfers",
        check=on_safety_value("transfers_pausable", lambda power: power),
        families=EVM,
    ),
    Rule(
        name="can_blacklist",
        severity="warn",
        message="The owner can blacklist wallets from trading",
        check=on_safety_value("can_blacklist", lambda power: power),
        families=EVM,
    ),
]


def evaluate(evidence: Evidence) -> tuple[list[schemas.Finding], list[str]]:
    """Run every rule. Returns the red flags and the names of unchecked rules."""
    findings = []
    unchecked = []

    for rule in RULES:
        if evidence.family not in rule.families:
            continue
        flagged = rule.check(evidence)
        if flagged is None:
            unchecked.append(rule.name)
            continue
        if not flagged:
            continue

        severity = rule.severity
        if evidence.established and rule.established_severity:
            severity = rule.established_severity
        findings.append(schemas.Finding(rule=rule.name, severity=severity, message=rule.message))

    return findings, unchecked


# Rules whose failure alone means Avoid. If one of them could not be checked,
# the coin cannot earn the best verdict.
FAIL_RULES = {rule.name for rule in RULES if rule.severity == "fail"}
WARN_RULES = {rule.name for rule in RULES if rule.severity == "warn"}


def risk_score(findings: list[schemas.Finding]) -> int:
    """0-100, higher is riskier."""
    return min(100, sum(SEVERITY_POINTS[finding.severity] for finding in findings))


def worst_case_score(findings: list[schemas.Finding], unchecked: list[str]) -> int:
    """The score if every unchecked warning had fired. The verdict uses this, so
    missing data can never lower it: without DexScreener, young_pair goes
    unchecked, and counting it as passed could turn High risk into Watch."""
    return risk_score(findings) + SEVERITY_POINTS["warn"] * len(WARN_RULES & set(unchecked))


def verdict_for(findings: list[schemas.Finding], unchecked: list[str]) -> str:
    if any(finding.severity == "fail" for finding in findings):
        return "Avoid"
    if worst_case_score(findings, unchecked) >= HIGH_RISK_SCORE or FAIL_RULES & set(unchecked):
        return "High risk"
    return "Watch"


def assess(evidence: Evidence) -> schemas.Assessment:
    """Run the rules and turn their findings into a score and a verdict."""
    findings, unchecked = evaluate(evidence)
    return schemas.Assessment(
        score=risk_score(findings),
        verdict=verdict_for(findings, unchecked),
        findings=findings,
        unchecked=unchecked,
    )

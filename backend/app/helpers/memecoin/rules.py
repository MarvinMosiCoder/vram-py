"""Rule engine: objective red flags, written as data.

Each rule's check returns True (red flag), False (fine), or None (the data it
needs is missing). None is reported as unchecked, never as a pass: a RugCheck
outage must not make a coin look safe.
"""
from dataclasses import dataclass
from typing import Callable, Literal

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
# Risk points per finding; the score is their sum, capped at 100.
SEVERITY_POINTS = {"fail": 40, "warn": 10}
HIGH_RISK_SCORE = 40


@dataclass
class Evidence:
    """Everything the rules can look at. A source that failed is None."""
    market: schemas.MarketData | None
    safety: schemas.SafetyData | None

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


@dataclass(frozen=True)
class Rule:
    name: str
    severity: Severity
    message: str
    check: Callable[[Evidence], bool | None]
    # Severity for established coins, when it differs.
    established_severity: Severity | None = None


def on_safety(test: Callable[[schemas.SafetyData], bool]) -> Callable[[Evidence], bool | None]:
    """Wrap a test that needs RugCheck data: without it the rule is unchecked."""
    return lambda e: None if e.safety is None else test(e.safety)


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
    ),
    Rule(
        name="freeze_authority",
        severity="fail",
        message="The dev can freeze holders' tokens so they cannot sell",
        check=on_safety(lambda s: s.freeze_authority is not None),
    ),
    Rule(
        name="rugged",
        severity="fail",
        message="RugCheck marks this token as rugged",
        check=on_safety(lambda s: s.rugged),
    ),
    Rule(
        name="creator_rugged_before",
        severity="fail",
        message="RugCheck says this creator has rugged tokens before",
        check=on_safety(lambda s: any(risk.name == CREATOR_RUGGED_RISK for risk in s.risks)),
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
        check=on_safety(lambda s: s.lp_locked_pct is not None and s.lp_locked_pct < MIN_LP_LOCKED_PCT),
    ),
    Rule(
        name="top10_concentrated",
        severity="fail",
        established_severity="warn",
        message=f"The top 10 holders own more than {MAX_TOP10_PCT}% (pools excluded)",
        check=on_safety(lambda s: s.top10_pct > MAX_TOP10_PCT),
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
        check=on_safety(lambda s: s.total_holders is not None and s.total_holders < FEW_HOLDERS),
    ),
    Rule(
        name="creator_holds_supply",
        severity="warn",
        message=f"The creator still holds more than {MAX_CREATOR_PCT}% of the supply",
        check=on_safety(lambda s: s.creator_pct is not None and s.creator_pct > MAX_CREATOR_PCT),
    ),
    Rule(
        name="insiders_in_top10",
        severity="warn",
        message="RugCheck links some top-10 holders to each other (insiders)",
        check=on_safety(lambda s: s.top10_insiders > 0),
    ),
    Rule(
        name="transfer_fee",
        severity="warn",
        message="Every transfer pays a fee to the token's authority",
        check=on_safety(lambda s: (s.transfer_fee_pct or 0) > 0),
    ),
    Rule(
        name="mutable_metadata",
        severity="warn",
        message="The owner can change the token's name, symbol, and image",
        check=on_safety(lambda s: bool(s.mutable_metadata)),
    ),
]


def evaluate(evidence: Evidence) -> tuple[list[schemas.Finding], list[str]]:
    """Run every rule. Returns the red flags and the names of unchecked rules."""
    findings = []
    unchecked = []

    for rule in RULES:
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


def risk_score(findings: list[schemas.Finding]) -> int:
    """0-100, higher is riskier."""
    return min(100, sum(SEVERITY_POINTS[finding.severity] for finding in findings))


def verdict_for(findings: list[schemas.Finding], unchecked: list[str]) -> str:
    if any(finding.severity == "fail" for finding in findings):
        return "Avoid"
    if risk_score(findings) >= HIGH_RISK_SCORE or FAIL_RULES & set(unchecked):
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

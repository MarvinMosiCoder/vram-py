"""Rule engine tests on saved coins. Ages are set explicitly; see conftest.py."""
import dataclasses

import pytest

from app import schemas
from app.helpers.memecoin import rules

ESTABLISHED = 1000 * 24
BONK = "bonk-DezXAZ8z"
EPUMP = "epump-7haJedyf"
FLUFFS = "fluffs-2Kjgagqi"
STONKWHEEL = "stonkwheel-FAvikGwx"

SCENARIOS = [
    (BONK, ESTABLISHED, "Watch"),
    (EPUMP, 2, "Watch"),
    (FLUFFS, 18, "Avoid"),
    (STONKWHEEL, 2, "Avoid"),
]


def rule_names(result: schemas.Assessment) -> set[str]:
    return {finding.rule for finding in result.findings}


def findings(fails: int = 0, warns: int = 0) -> list[schemas.Finding]:
    return (
        [schemas.Finding(rule="f", severity="fail", message="") for _ in range(fails)]
        + [schemas.Finding(rule="w", severity="warn", message="") for _ in range(warns)]
    )


@pytest.mark.parametrize("coin, age_hours, verdict", SCENARIOS)
def test_verdict(evidence, coin, age_hours, verdict):
    assert rules.assess(evidence(coin, age_hours)).verdict == verdict


@pytest.mark.parametrize("coin, age_hours, verdict", SCENARIOS)
def test_missing_rugcheck_never_earns_watch(evidence, coin, age_hours, verdict):
    without_rugcheck = dataclasses.replace(evidence(coin, age_hours), safety=None)
    assert rules.assess(without_rugcheck).verdict != "Watch"


def test_established_coin_gets_warnings_instead_of_fails(evidence):
    result = rules.assess(evidence(BONK, ESTABLISHED))
    severities = {finding.rule: finding.severity for finding in result.findings}
    assert severities["lp_unlocked"] == "warn"
    assert severities["top10_concentrated"] == "warn"


def test_the_same_coin_fails_when_young(evidence):
    result = rules.assess(evidence(BONK, age_hours=2))
    assert result.verdict == "Avoid"
    assert "lp_unlocked" in rule_names(result)


def test_creator_with_rug_history_fails(evidence):
    # Also guards RugCheck's risk name: if they rename it, this test fails.
    result = rules.assess(evidence(STONKWHEEL, 2))
    assert "creator_rugged_before" in rule_names(result)


def test_pump_fun_liquidity_comes_from_rugcheck(evidence):
    coin = evidence(EPUMP, 2)
    assert coin.market.liquidity_usd is None  # DexScreener has no figure for the bonding curve
    assert coin.liquidity_usd > rules.MIN_LIQUIDITY_USD


def test_rugcheck_without_pools_is_not_zero_liquidity(evidence):
    # RugCheck had indexed no pools for FLUFFS and reported 0; DexScreener saw about $10k.
    result = rules.assess(evidence(FLUFFS, 18))
    assert "liquidity_too_low" not in rule_names(result)


def test_score_is_capped_at_100():
    assert rules.risk_score(findings(fails=3)) == 100


def test_four_warnings_make_high_risk():
    assert rules.verdict_for(findings(warns=3), []) == "Watch"
    assert rules.verdict_for(findings(warns=4), []) == "High risk"

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


def test_rugcheck_without_pools_leaves_lp_lock_unchecked(evidence):
    # With no pools indexed there is nothing to measure the lock against.
    assert "lp_unlocked" in rules.assess(evidence(FLUFFS, 18)).unchecked


@pytest.mark.parametrize("field, rule", [
    ("lp_locked_pct", "lp_unlocked"),
    ("top10_pct", "top10_concentrated"),
])
def test_missing_field_of_a_fail_rule_never_earns_watch(evidence, field, rule):
    coin = evidence(EPUMP, 2)
    coin = dataclasses.replace(coin, safety=coin.safety.model_copy(update={field: None}))
    result = rules.assess(coin)
    assert rule in result.unchecked
    assert result.verdict == "High risk"


def test_missing_dexscreener_cannot_turn_high_risk_into_watch(evidence):
    # Four warnings, one of them young_pair, which needs DexScreener.
    coin = evidence(EPUMP, 2)
    coin = dataclasses.replace(coin, safety=coin.safety.model_copy(update={"mutable_metadata": True, "transfer_fee_pct": 1.0}))
    assert rules.assess(coin).verdict == "High risk"

    without_dexscreener = rules.assess(dataclasses.replace(coin, market=None))
    assert "young_pair" in without_dexscreener.unchecked
    assert without_dexscreener.verdict == "High risk"


def test_unchecked_warnings_count_toward_high_risk():
    assert rules.verdict_for(findings(warns=2), ["young_pair"]) == "Watch"
    assert rules.verdict_for(findings(warns=3), ["young_pair"]) == "High risk"
    # The score itself stays what was found; only the verdict assumes the worst.
    assert rules.risk_score(findings(warns=3)) == 30


def test_blacklisted_creator_fails(evidence):
    coin = evidence(BONK, ESTABLISHED)
    result = rules.assess(dataclasses.replace(coin, blacklist=frozenset({coin.safety.creator})))
    assert "creator_blacklisted" in rule_names(result)
    assert result.verdict == "Avoid"


def test_blacklisted_top_holder_warns(evidence):
    coin = evidence(BONK, ESTABLISHED)
    holder = coin.safety.top_holders[0].owner
    result = rules.assess(dataclasses.replace(coin, blacklist=frozenset({holder})))
    severities = {finding.rule: finding.severity for finding in result.findings}
    assert severities["holder_blacklisted"] == "warn"
    assert "creator_blacklisted" not in severities


def test_unknown_creator_is_unchecked_only_when_the_blacklist_has_entries(evidence):
    coin = evidence(FLUFFS, 18)  # RugCheck names no creator for FLUFFS
    assert coin.safety.creator is None
    assert "creator_blacklisted" not in rules.assess(coin).unchecked
    with_list = rules.assess(dataclasses.replace(coin, blacklist=frozenset({"SomeScamDevWa11et1111111111111111111"})))
    assert "creator_blacklisted" in with_list.unchecked


def with_safety(coin, **fields):
    return dataclasses.replace(coin, safety=coin.safety.model_copy(update=fields))


def launches(count: int, market_cap: float) -> list[schemas.CreatorToken]:
    return [schemas.CreatorToken(mint=f"Mint{i}", market_cap=market_cap) for i in range(count)]


def test_a_creator_whose_launches_died_fails(evidence):
    # STONKWHEEL's creator launched 50 other tokens; 49 are worth under $10k.
    result = rules.assess(evidence(STONKWHEEL, 2))
    severities = {finding.rule: finding.severity for finding in result.findings}
    assert severities["creator_dead_tokens"] == "fail"
    assert severities["creator_many_launches"] == "warn"


@pytest.mark.parametrize("tokens, flagged", [
    (launches(4, 3_000), set()),
    (launches(5, 50_000), {"creator_many_launches"}),
    (launches(5, 3_000), {"creator_many_launches", "creator_dead_tokens"}),
    ([], set()),
])
def test_creator_history_thresholds(evidence, tokens, flagged):
    result = rules.assess(with_safety(evidence(BONK, ESTABLISHED), creator_tokens=tokens))
    assert rule_names(result) & {"creator_many_launches", "creator_dead_tokens"} == flagged


def test_unknown_creator_leaves_its_history_unchecked(evidence):
    result = rules.assess(evidence(FLUFFS, 18))
    assert {"creator_dead_tokens", "creator_many_launches"} <= set(result.unchecked)


def test_linked_wallets_holding_a_tenth_warn(evidence):
    coin = evidence(BONK, ESTABLISHED)
    assert "linked_wallets_hold" not in rule_names(rules.assess(coin))
    assert "linked_wallets_hold" in rule_names(rules.assess(with_safety(coin, linked_wallets_pct=12.5)))


def test_no_website_and_no_socials_warns(evidence):
    coin = evidence(STONKWHEEL, 2)
    assert "no_socials" not in rule_names(rules.assess(coin))  # it lists an X post
    bare = dataclasses.replace(coin, market=coin.market.model_copy(update={"websites": [], "socials": []}))
    assert "no_socials" in rule_names(rules.assess(bare))


def test_a_domain_registered_for_the_launch_warns(evidence):
    # EPUMP's domain was registered the day before its pool opened.
    assert "new_domain" in rule_names(rules.assess(evidence(EPUMP, 2, domain_age_days=1)))
    assert "new_domain" not in rule_names(rules.assess(evidence(EPUMP, 2, domain_age_days=400)))


def test_domain_age_unknown_is_unchecked_but_no_website_is_not(evidence):
    coin = evidence(EPUMP, 2)
    unknown = dataclasses.replace(coin, web=coin.web.model_copy(update={"domain_age_days": None}))
    assert "new_domain" in rules.assess(unknown).unchecked
    # STONKWHEEL lists no website, so there is no domain to judge.
    assert "new_domain" not in rules.assess(evidence(STONKWHEEL, 2)).unchecked


def test_a_shared_host_is_not_judged_by_its_age(evidence):
    coin = evidence(EPUMP, 2)
    hosted = dataclasses.replace(coin, web=coin.web.model_copy(update={"hosted": True, "domain_age_days": None}))
    result = rules.assess(hosted)
    assert "new_domain" not in rule_names(result) and "new_domain" not in result.unchecked


def test_score_is_capped_at_100():
    assert rules.risk_score(findings(fails=3)) == 100


def test_four_warnings_make_high_risk():
    assert rules.verdict_for(findings(warns=3), []) == "Watch"
    assert rules.verdict_for(findings(warns=4), []) == "High risk"

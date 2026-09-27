"""EVM chains: the chain registry, GoPlus parsing, EVM rules, and the routes
with an EVM token. Saved GoPlus and DexScreener answers; no network."""
import asyncio
import dataclasses
import json
from pathlib import Path
from typing import get_args

import httpx
import pytest

from app import schemas
from app.helpers.memecoin import analyzer, chains, goplus, rules

PEPE = "pepe-0x698250"                 # Ethereum, established, ownership renounced
ROBINHOOD = "robinhood-0x008df4"       # Robinhood Chain, Uniswap V4 only
PAUSABLE = "pausable-0x6331bf"         # BSC: can pause transfers, but ownership renounced
UNVERIFIED = "unverified-0x8562c3"     # Ethereum: contract source not verified
PEPE_ADDRESS = "0x6982508145454ce325ddbe47a25d4ec3d2311933"
PEPE_CHECKSUMMED = "0x6982508145454Ce325dDbE47a25d4ec3d2311933"
ESTABLISHED = 1000 * 24
FIXTURES = Path(__file__).parent / "fixtures"


def rule_names(result: schemas.Assessment) -> set[str]:
    return {finding.rule for finding in result.findings}


# --- The chain registry -----------------------------------------------------------

def test_the_route_literal_matches_the_registry():
    assert set(get_args(schemas.admin.memecoin.ChainId)) == set(chains.CHAINS)


def test_every_evm_chain_has_a_goplus_id_and_an_explorer():
    for chain in chains.CHAINS.values():
        assert "{address}" in chain.explorer_token_url
        assert (chain.goplus_id is None) == (chain.family == "solana")


@pytest.mark.parametrize("chain, address, valid", [
    ("ethereum", PEPE_CHECKSUMMED, True),
    ("robinhood", PEPE_ADDRESS, True),
    ("ethereum", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", False),
    ("solana", PEPE_ADDRESS, False),
    ("bsc", "0x1234", False),
])
def test_addresses_are_checked_per_family(chain, address, valid):
    assert chains.is_valid_address(chains.CHAINS[chain], address) is valid


def test_only_evm_addresses_change_case():
    assert chains.normalize(PEPE_CHECKSUMMED) == PEPE_ADDRESS
    assert chains.normalize("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263") == "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"


# --- GoPlus parsing -------------------------------------------------------------------

def summary(coin):
    address, record = next(iter(json.loads((FIXTURES / coin / "goplus.json").read_text(encoding="utf-8"))["result"].items()))
    return goplus.summarize_security(record, address)


def test_pepe_is_open_source_with_renounced_ownership():
    safety = summary(PEPE)
    assert (safety.honeypot, safety.open_source, safety.owner_renounced) == (False, True, True)
    assert (safety.buy_tax_pct, safety.sell_tax_pct, safety.transfer_fee_pct) == (0, 0, 0)
    # GoPlus reports a pause function, but nobody owns the contract to use it.
    assert safety.transfers_pausable is False
    assert safety.creator == safety.creator.lower()


def test_burn_addresses_and_pools_are_not_top_holders():
    pepe = summary(PEPE)
    assert all(not holder.owner.startswith("0x00000000") for holder in pepe.top_holders)
    bsc = summary(PAUSABLE)
    # BSC's biggest holder is its PancakeSwap pair, which is left out.
    assert "0xff0a8df8" not in {holder.owner[:10] for holder in bsc.top_holders}
    assert round(bsc.top10_pct, 2) < 29


def test_burned_lp_tokens_count_as_locked():
    # 99.93% of the BSC token's LP tokens sit at the zero address (GoPlus marks it locked).
    assert round(summary(PAUSABLE).lp_locked_pct, 2) == 99.93
    assert summary(ROBINHOOD).lp_locked_pct == 0
    # A burn address counts even when GoPlus does not mark it locked.
    record = {"lp_holders": [
        {"address": "0x000000000000000000000000000000000000dEaD", "is_locked": 0, "percent": "0.6"},
        {"address": "0xabc0000000000000000000000000000000000001", "is_locked": 0, "percent": "0.4"},
    ]}
    assert goplus.summarize_security(record, PEPE_ADDRESS).lp_locked_pct == pytest.approx(60)


def test_an_unknown_owner_stays_unknown():
    safety = summary(ROBINHOOD)
    assert safety.owner is None and safety.owner_renounced is None
    assert safety.owner_can_mint is False  # GoPlus says there is no mint function at all


def test_an_unverified_contract_leaves_owner_powers_unknown():
    safety = summary(UNVERIFIED)
    assert safety.open_source is False
    assert safety.owner_can_mint is None and safety.honeypot is None and safety.owner_can_change_balances is None


def test_an_owner_power_counts_while_the_owner_is_active():
    record = {"owner_address": "0xabc0000000000000000000000000000000000001", "is_mintable": "1", "transfer_pausable": "1"}
    safety = goplus.summarize_security(record, PEPE_ADDRESS)
    assert safety.owner_can_mint and safety.transfers_pausable
    # Renounced, but the ownership can be taken back: still a power.
    reclaimable = goplus.summarize_security({**record, "owner_address": "0x" + "0" * 40, "can_take_back_ownership": "1"}, PEPE_ADDRESS)
    assert reclaimable.owner_can_mint and reclaimable.can_reclaim_ownership


def test_cannot_sell_all_is_a_honeypot():
    assert goplus.summarize_security({"is_honeypot": "0", "cannot_sell_all": "1"}, PEPE_ADDRESS).honeypot is True


# --- GoPlus requests -------------------------------------------------------------------

def fetch(*answers):
    queue = list(answers)
    requests = []

    def server(request):
        requests.append(request)
        return httpx.Response(200, json=queue.pop(0))

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(server)) as client:
            try:
                return await goplus.fetch_token_security(client, chains.CHAINS["ethereum"], PEPE_CHECKSUMMED)
            except goplus.GoPlusError as error:
                return error

    return asyncio.run(run()), requests


@pytest.fixture
def no_wait(monkeypatch):
    async def instant(seconds):
        return None
    monkeypatch.setattr(goplus.asyncio, "sleep", instant)


def test_a_rate_limit_is_retried_once(no_wait):
    # GoPlus answers HTTP 200 with code 4029 when it rate-limits.
    rate_limited = json.loads((FIXTURES / "goplus-errors" / "rate-limited.json").read_text(encoding="utf-8"))
    ok = json.loads((FIXTURES / PEPE / "goplus.json").read_text(encoding="utf-8"))
    record, requests = fetch(rate_limited, ok)
    assert record["token_symbol"] == "PEPE" and len(requests) == 2
    assert requests[0].url.params["contract_addresses"] == PEPE_CHECKSUMMED
    assert "/token_security/1" in requests[0].url.path

    error, requests = fetch(rate_limited, rate_limited)
    assert str(error) == "code 4029: too many requests" and len(requests) == 2


def test_no_data_for_the_token_is_an_error(no_wait):
    error, _ = fetch({"code": 1, "message": "OK", "result": {}})
    assert str(error) == "no data for this token"


# --- EVM rules -----------------------------------------------------------------------

def test_an_evm_coin_never_runs_solana_only_rules(evidence):
    result = rules.assess(evidence(PEPE, ESTABLISHED))
    solana_only = {rule.name for rule in rules.RULES if rule.families == rules.SOLANA}
    assert not solana_only & (rule_names(result) | set(result.unchecked))


def test_pepe_is_watch_like_bonk(evidence):
    # Established, renounced, no tax; its unlocked LP and holder concentration only warn.
    result = rules.assess(evidence(PEPE, ESTABLISHED, domain_age_days=900))
    assert result.verdict == "Watch"
    assert {"lp_unlocked", "top10_concentrated"} <= rule_names(result)


def test_a_renounced_pause_function_is_not_flagged(evidence):
    result = rules.assess(evidence(PAUSABLE, ESTABLISHED, domain_age_days=900))
    assert "transfers_pausable" not in rule_names(result) | set(result.unchecked)


def test_an_unverified_contract_is_avoid(evidence):
    result = rules.assess(evidence(UNVERIFIED, ESTABLISHED))
    assert result.verdict == "Avoid"
    assert "not_open_source" in rule_names(result)
    assert {"honeypot", "owner_can_mint", "owner_changes_balances"} <= set(result.unchecked)


def with_safety(coin, **fields):
    return dataclasses.replace(coin, safety=coin.safety.model_copy(update=fields))


@pytest.mark.parametrize("fields, rule, severity", [
    ({"honeypot": True}, "honeypot", "fail"),
    ({"sell_tax_pct": 15.0}, "sell_tax_too_high", "fail"),
    ({"owner_can_mint": True}, "owner_can_mint", "fail"),
    ({"owner_can_change_balances": True}, "owner_changes_balances", "fail"),
    ({"can_reclaim_ownership": True}, "can_reclaim_ownership", "fail"),
    ({"creator_made_honeypots": True}, "creator_made_honeypots", "fail"),
    ({"hidden_owner": True}, "hidden_owner", "warn"),
    ({"proxy": True}, "upgradeable_proxy", "warn"),
    ({"transfers_pausable": True}, "transfers_pausable", "warn"),
    ({"can_blacklist": True}, "can_blacklist", "warn"),
])
def test_each_evm_rule(evidence, fields, rule, severity):
    result = rules.assess(with_safety(evidence(PEPE, ESTABLISHED, domain_age_days=900), **fields))
    assert {finding.rule: finding.severity for finding in result.findings}[rule] == severity


def test_a_sell_tax_at_the_limit_is_only_a_fee(evidence):
    result = rules.assess(with_safety(evidence(PEPE, ESTABLISHED, domain_age_days=900), sell_tax_pct=10.0, transfer_fee_pct=10.0))
    assert "sell_tax_too_high" not in rule_names(result)
    assert "transfer_fee" in rule_names(result)


def test_an_evm_creator_on_the_blacklist_fails(evidence):
    coin = evidence(PEPE, ESTABLISHED, domain_age_days=900)
    result = rules.assess(dataclasses.replace(coin, blacklist=frozenset({coin.safety.creator})))
    assert "creator_blacklisted" in rule_names(result)


# --- Collection and report building ---------------------------------------------------------

def test_an_evm_coin_is_checked_with_goplus_not_rugcheck(monkeypatch, raw):
    asked = []

    async def pairs(client, chain, address):
        asked.append(("dexscreener", chain))
        return raw(PEPE, "dexscreener")

    async def rugcheck_report(client, address):
        asked.append(("rugcheck", address))
        return {}

    async def goplus_record(client, chain, address):
        asked.append(("goplus", chain.goplus_id))
        return next(iter(raw(PEPE, "goplus")["result"].values()))

    async def no_lookup(client, domain):
        return None

    monkeypatch.setattr(analyzer.dexscreener, "fetch_token_pairs", pairs)
    monkeypatch.setattr(analyzer.rugcheck, "fetch_report", rugcheck_report)
    monkeypatch.setattr(analyzer.goplus, "fetch_token_security", goplus_record)
    monkeypatch.setattr(analyzer.web, "fetch_rdap", no_lookup)
    monkeypatch.setattr(analyzer.web, "fetch_wayback", no_lookup)

    sources = asyncio.run(analyzer.collect(PEPE_ADDRESS, "ethereum"))
    assert ("rugcheck", PEPE_ADDRESS) not in asked
    assert ("dexscreener", "ethereum") in asked and ("goplus", "1") in asked
    assert sources.rugcheck is None and sources.goplus["token_symbol"] == "PEPE"


def test_a_goplus_failure_is_an_error_and_keeps_the_coin_from_watch(sources):
    report = analyzer.build_report(PEPE_ADDRESS, sources(PEPE, goplus=goplus.GoPlusError("code 4029: too many requests")), chain="ethereum")
    assert report.errors == {"goplus": "GoPlusError: code 4029: too many requests"}
    assert report.safety is None and report.market is not None
    assert report.assessment.verdict != "Watch"


def test_the_report_names_its_chain(sources):
    report = analyzer.build_report(PEPE_ADDRESS, sources(PEPE), chain="ethereum")
    assert report.chain == "ethereum"
    assert report.market.address == PEPE_CHECKSUMMED  # DexScreener's spelling, matched in any case


# --- Routes with an EVM token -------------------------------------------------------------

@pytest.fixture
def pepe_sources(monkeypatch, sources):
    asked = []

    async def fake_collect(address, chain="solana"):
        asked.append((chain, address))
        return sources(PEPE)

    monkeypatch.setattr(analyzer, "collect", fake_collect)
    return asked


def test_analyze_an_ethereum_token(client, pepe_sources, db_session):
    response = client.get(f"/memecoin/analyze/ethereum/{PEPE_CHECKSUMMED}")
    assert response.status_code == 200
    report = response.json()
    assert (report["chain"], report["address"]) == ("ethereum", PEPE_ADDRESS)
    assert pepe_sources == [("ethereum", PEPE_ADDRESS)]  # normalized before collecting

    # The lower-case spelling hits the same cache entry, and the history holds one report.
    client.get(f"/memecoin/analyze/ethereum/{PEPE_ADDRESS}")
    assert len(pepe_sources) == 1
    saved = client.get("/memecoin/reports", params={"address": PEPE_CHECKSUMMED}).json()
    assert [(row["chain"], row["symbol"]) for row in saved] == [("ethereum", "PEPE")]


def test_the_same_address_on_two_chains_is_two_reports(client, pepe_sources):
    client.get(f"/memecoin/analyze/ethereum/{PEPE_ADDRESS}")
    client.get(f"/memecoin/analyze/base/{PEPE_ADDRESS}")
    assert pepe_sources == [("ethereum", PEPE_ADDRESS), ("base", PEPE_ADDRESS)]


def test_evm_wallets_are_stored_in_lower_case(client, pepe_sources):
    creator = summary(PEPE).creator
    added = client.post("/memecoin/wallets", json={"address": creator.upper().replace("0X", "0x"), "list": "blacklist"})
    assert added.status_code == 201 and added.json()["address"] == creator
    assert client.post("/memecoin/wallets", json={"address": creator, "list": "blacklist"}).status_code == 409

    report = client.get(f"/memecoin/analyze/ethereum/{PEPE_ADDRESS}").json()
    assert "creator_blacklisted" in {finding["rule"] for finding in report["assessment"]["findings"]}


def test_a_trade_keeps_its_chain(client):
    trade = client.post("/memecoin/trades", json={"chain": "robinhood", "address": PEPE_CHECKSUMMED, "entry_price": 0.5, "entry_reason": "test"}).json()
    assert (trade["chain"], trade["address"]) == ("robinhood", PEPE_ADDRESS)
    assert client.post("/memecoin/trades", json={"address": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "entry_price": 1, "entry_reason": "x"}).json()["chain"] == "solana"


def test_evm_wallets_on_the_watch_list_are_skipped(client, monkeypatch):
    from app.helpers.memecoin import solana_rpc

    async def never(*args, **kwargs):
        raise AssertionError("the Solana RPC was asked about an EVM wallet")

    monkeypatch.setattr(solana_rpc, "signatures", never)
    client.post("/memecoin/wallets", json={"address": PEPE_ADDRESS, "list": "watch"})
    result = client.post("/memecoin/watch/check").json()
    assert result["wallets_checked"] == 0
    assert result["errors"] == {PEPE_ADDRESS: "EVM wallets are not watched yet; only Solana wallets are scanned"}
    assert client.get("/memecoin/watch").json()["wallets"] == 0

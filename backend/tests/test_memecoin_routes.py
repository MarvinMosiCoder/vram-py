"""Route tests for search and analyze: the memecoin router alone, with login,
database, and network replaced.

The app, client, user, and in-memory database fixtures are in conftest.py. The
functions that call DexScreener and RugCheck are swapped for saved responses.
"""
import httpx
import pytest
from fastapi.testclient import TestClient

from app import models
from app.core.auth import get_current_user
from app.helpers.memecoin import analyzer, dexscreener

BONK = "bonk-DezXAZ8z"
BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
EVM_ADDRESS = "0x6982508145454Ce325dDbE47a25d4ec3d2311933"


@pytest.fixture
def saved_search(monkeypatch, raw):
    """Search answers with the saved Bonk search. Returns the list of queries."""
    queries = []
    pairs = raw(BONK, "search")
    # The saved search holds only Solana pairs. Live searches mix chains, so add
    # a copy on Ethereum (supported) and on PulseChain (not supported).
    ethereum = {**pairs[0], "chainId": "ethereum", "baseToken": {**pairs[0]["baseToken"], "address": EVM_ADDRESS}}
    pulsechain = {**pairs[0], "chainId": "pulsechain", "baseToken": {**pairs[0]["baseToken"], "address": "0x" + "1" * 40}}

    async def fake_search_pairs(client, query):
        queries.append(query)
        return [ethereum, pulsechain, *pairs]

    monkeypatch.setattr(dexscreener, "search_pairs", fake_search_pairs)
    return queries


@pytest.fixture
def saved_sources(monkeypatch, sources):
    """analyze() collects the saved Bonk responses. Returns the addresses asked for."""
    addresses = []

    async def fake_collect(address, chain="solana"):
        addresses.append(address)
        return sources(BONK)

    monkeypatch.setattr(analyzer, "collect", fake_collect)
    return addresses


def test_search_returns_supported_chains_most_traded_first(client, saved_search):
    response = client.get("/memecoin/search", params={"q": "bonk"})

    assert response.status_code == 200
    tokens = response.json()
    assert tokens[0]["address"] == BONK_MINT
    # PulseChain is not a supported chain, so its copy is left out.
    assert {token["chain"] for token in tokens} == {"solana", "ethereum"}
    assert saved_search == ["bonk"]


def test_search_can_keep_one_chain(client, saved_search):
    solana = client.get("/memecoin/search", params={"q": "bonk", "chain": "solana"}).json()
    assert {token["chain"] for token in solana} == {"solana"}
    ethereum = client.get("/memecoin/search", params={"q": "bonk", "chain": "ethereum"}).json()
    assert [token["address"] for token in ethereum] == [EVM_ADDRESS]
    assert client.get("/memecoin/search", params={"q": "bonk", "chain": "pulsechain"}).status_code == 422


def test_search_rejects_a_short_query_before_calling_dexscreener(client, saved_search):
    response = client.get("/memecoin/search", params={"q": "b"})

    assert response.status_code == 422
    assert saved_search == []


def test_search_reports_a_dexscreener_failure_as_502(client, monkeypatch):
    async def failing_search(client, query):
        raise httpx.ConnectTimeout("")

    monkeypatch.setattr(dexscreener, "search_pairs", failing_search)
    response = client.get("/memecoin/search", params={"q": "bonk"})

    assert response.status_code == 502
    assert response.json()["detail"] == "DexScreener search failed: ConnectTimeout"


def test_analyze_returns_the_report(client, saved_sources):
    response = client.get(f"/memecoin/analyze/solana/{BONK_MINT}")

    assert response.status_code == 200
    report = response.json()
    assert report["address"] == BONK_MINT
    assert report["assessment"]["verdict"] == "Watch"
    assert report["errors"] == {}
    assert saved_sources == [BONK_MINT]


def test_analyze_reports_a_failed_source_inside_the_report(client, monkeypatch, sources):
    async def rugcheck_down(address, chain="solana"):
        return sources(BONK, rugcheck=httpx.ConnectTimeout(""))

    monkeypatch.setattr(analyzer, "collect", rugcheck_down)
    response = client.get(f"/memecoin/analyze/solana/{BONK_MINT}")

    assert response.status_code == 200
    report = response.json()
    assert report["safety"] is None
    assert report["errors"] == {"rugcheck": "ConnectTimeout"}
    assert report["assessment"]["verdict"] == "High risk"


@pytest.mark.parametrize("path", [
    f"/memecoin/analyze/ethereum/{BONK_MINT}",   # a Solana address on an EVM chain
    f"/memecoin/analyze/solana/{EVM_ADDRESS}",   # an EVM address on Solana
    f"/memecoin/analyze/pulsechain/{EVM_ADDRESS}",  # a chain the analyzer does not cover
    "/memecoin/analyze/ethereum/0x1234",
])
def test_analyze_rejects_an_address_that_does_not_fit_the_chain(client, saved_sources, path):
    assert client.get(path).status_code == 422
    assert saved_sources == []


@pytest.mark.parametrize("path", ["/memecoin/search?q=bonk", f"/memecoin/analyze/solana/{BONK_MINT}"])
def test_routes_require_a_login(app, saved_search, saved_sources, path):
    del app.dependency_overrides[get_current_user]
    response = TestClient(app).get(path)

    assert response.status_code == 401
    assert saved_search == [] and saved_sources == []


def test_analyze_reuses_a_report_for_a_few_minutes(client, saved_sources):
    first = client.get(f"/memecoin/analyze/solana/{BONK_MINT}").json()
    second = client.get(f"/memecoin/analyze/solana/{BONK_MINT}").json()

    assert saved_sources == [BONK_MINT]
    assert second["checked_at"] == first["checked_at"]


def test_analyze_fetches_again_once_the_cache_expires(client, saved_sources, monkeypatch):
    monkeypatch.setattr(analyzer, "CACHE_SECONDS", 0)
    client.get(f"/memecoin/analyze/solana/{BONK_MINT}")
    client.get(f"/memecoin/analyze/solana/{BONK_MINT}")

    assert saved_sources == [BONK_MINT, BONK_MINT]


def test_a_report_with_a_failed_source_is_not_cached(client, monkeypatch, sources):
    calls = []

    async def rugcheck_down(address, chain="solana"):
        calls.append(address)
        return sources(BONK, rugcheck=httpx.ConnectTimeout(""))

    monkeypatch.setattr(analyzer, "collect", rugcheck_down)
    client.get(f"/memecoin/analyze/solana/{BONK_MINT}")
    client.get(f"/memecoin/analyze/solana/{BONK_MINT}")

    assert calls == [BONK_MINT, BONK_MINT]


def saved_rows(db_session):
    return db_session.query(models.MemecoinReport).all()


def test_analyze_saves_a_report_once_while_it_is_cached(client, saved_sources, db_session):
    first = client.get(f"/memecoin/analyze/solana/{BONK_MINT}").json()
    client.get(f"/memecoin/analyze/solana/{BONK_MINT}")

    rows = saved_rows(db_session)
    assert len(rows) == 1
    assert (rows[0].address, rows[0].symbol, rows[0].verdict, rows[0].score) == (BONK_MINT, "Bonk", "Watch", 30)
    assert rows[0].report["assessment"] == first["assessment"]
    assert rows[0].adm_user_id == 1


def test_each_fresh_fetch_is_saved(client, saved_sources, db_session, monkeypatch):
    monkeypatch.setattr(analyzer, "CACHE_SECONDS", 0)
    client.get(f"/memecoin/analyze/solana/{BONK_MINT}")
    client.get(f"/memecoin/analyze/solana/{BONK_MINT}")

    assert len(saved_rows(db_session)) == 2


def test_a_report_with_a_failed_source_is_saved_too(client, monkeypatch, sources, db_session):
    async def rugcheck_down(address, chain="solana"):
        return sources(BONK, rugcheck=httpx.ConnectTimeout(""))

    monkeypatch.setattr(analyzer, "collect", rugcheck_down)
    client.get(f"/memecoin/analyze/solana/{BONK_MINT}")

    rows = saved_rows(db_session)
    assert len(rows) == 1 and rows[0].verdict == "High risk"
    assert rows[0].report["errors"] == {"rugcheck": "ConnectTimeout"}


def test_blacklisting_the_creator_turns_the_verdict_to_avoid(client, saved_sources, raw):
    creator = raw(BONK, "rugcheck")["creator"]
    assert client.get(f"/memecoin/analyze/solana/{BONK_MINT}").json()["assessment"]["verdict"] == "Watch"

    added = client.post("/memecoin/wallets", json={"address": creator, "list": "blacklist", "label": "scam dev"})
    assert added.status_code == 201

    # The cached Watch report was judged without the blacklist, so it is fetched again.
    report = client.get(f"/memecoin/analyze/solana/{BONK_MINT}").json()
    assert saved_sources == [BONK_MINT, BONK_MINT]
    assert report["assessment"]["verdict"] == "Avoid"
    assert "creator_blacklisted" in {finding["rule"] for finding in report["assessment"]["findings"]}

    client.delete(f"/memecoin/wallets/{added.json()['id']}")
    assert client.get(f"/memecoin/analyze/solana/{BONK_MINT}").json()["assessment"]["verdict"] == "Watch"
    assert len(saved_sources) == 3


def test_the_good_dev_list_does_not_touch_verdicts_or_the_cache(client, saved_sources, raw):
    creator = raw(BONK, "rugcheck")["creator"]
    client.get(f"/memecoin/analyze/solana/{BONK_MINT}")
    client.post("/memecoin/wallets", json={"address": creator, "list": "good_dev"})

    assert client.get(f"/memecoin/analyze/solana/{BONK_MINT}").json()["assessment"]["verdict"] == "Watch"
    assert saved_sources == [BONK_MINT]


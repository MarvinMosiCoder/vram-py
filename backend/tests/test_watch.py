"""Watching wallets (Phase 9): transaction parsing, wallet scans, alerts, and
Telegram. The RPC and Telegram are replaced; no network."""
import asyncio
import json
from pathlib import Path

import httpx
import pytest

from app import models
from app.core.config import settings
from app.helpers.memecoin import solana_rpc, watch

SOLANA_FIXTURES = Path(__file__).parent / "fixtures" / "solana"
USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"


def saved_transaction(name: str) -> dict:
    return json.loads((SOLANA_FIXTURES / f"{name}.json").read_text(encoding="utf-8"))


BUY = saved_transaction("buy-transaction")
OTHER = saved_transaction("other-transaction")
WALLET = BUY["wallet"]
BOUGHT_MINT = "6UTgBWACzB1zX2GA2uEvVn6325XE99wNvkVTXv5qpump"


# --- Parsing -------------------------------------------------------------------

def test_a_token_gain_is_found_in_a_real_transaction():
    gains = solana_rpc.token_gains(BUY["transaction"], WALLET)
    assert [(gain.mint, round(gain.amount)) for gain in gains] == [(BOUGHT_MINT, 96_449_438)]
    assert solana_rpc.block_time(BUY["transaction"]).year == 2026


def test_a_transaction_without_gains_finds_nothing():
    assert solana_rpc.token_gains(OTHER["transaction"], WALLET) == []


def test_gaining_usdc_is_not_a_buy():
    tx = json.loads(json.dumps(BUY["transaction"]))
    for balance in tx["meta"]["postTokenBalances"] + tx["meta"]["preTokenBalances"]:
        balance["mint"] = USDC
    assert solana_rpc.token_gains(tx, WALLET) == []


def test_only_the_watched_owner_counts():
    assert solana_rpc.token_gains(BUY["transaction"], "SomeoneElse1111111111111111111111111111111") == []


# --- Scanning one wallet ---------------------------------------------------------

@pytest.fixture
def fake_rpc(monkeypatch):
    """The RPC answers from a list of signatures and saved transactions."""
    state = {"signatures": [], "transactions": {}, "calls": []}

    async def signatures(client, address, until, limit):
        state["calls"].append(("signatures", address, until))
        newer = []
        for entry in state["signatures"]:
            if entry["signature"] == until:
                break
            newer.append(entry)
        return newer[:limit]

    async def transaction(client, signature):
        state["calls"].append(("transaction", signature))
        return state["transactions"].get(signature)

    async def no_pause(seconds):
        return None

    monkeypatch.setattr(solana_rpc, "signatures", signatures)
    monkeypatch.setattr(solana_rpc, "transaction", transaction)
    monkeypatch.setattr(watch.asyncio, "sleep", no_pause)
    return state


def scan(last_signature):
    async def run():
        async with httpx.AsyncClient() as client:
            return await watch.scan_wallet(client, WALLET, last_signature)
    return asyncio.run(run())


def test_the_first_scan_only_records_where_to_start(fake_rpc):
    fake_rpc["signatures"] = [{"signature": "sig2"}, {"signature": "sig1"}]
    reached, found, waiting = scan(None)
    assert (reached, found, waiting) == ("sig2", [], 0)
    assert all(call[0] == "signatures" for call in fake_rpc["calls"])


def test_later_scans_report_new_gains_oldest_first(fake_rpc):
    fake_rpc["signatures"] = [{"signature": "buy"}, {"signature": "failed", "err": {"x": 1}}, {"signature": "other"}, {"signature": "seen"}]
    fake_rpc["transactions"] = {"buy": BUY["transaction"], "other": OTHER["transaction"]}

    reached, found, waiting = scan("seen")
    assert reached == "buy" and waiting == 0
    assert [(item.signature, item.mint) for item in found] == [("buy", BOUGHT_MINT)]
    # The failed transaction was never fetched.
    assert ("transaction", "failed") not in fake_rpc["calls"]


def test_a_backlog_is_worked_through_oldest_first_without_gaps(fake_rpc):
    # 30 new transactions, s29 the oldest; the buy is the very oldest one.
    fake_rpc["signatures"] = [{"signature": f"s{i}"} for i in range(30)] + [{"signature": "seen"}]
    fake_rpc["transactions"] = {"s29": BUY["transaction"]}

    reached, found, waiting = scan("seen")
    assert (reached, waiting) == ("s10", 10)
    assert [item.signature for item in found] == ["s29"]

    reached, found, waiting = scan("s10")
    assert (reached, waiting) == ("s0", 0)


# --- The check endpoint and alerts ---------------------------------------------------

@pytest.fixture
def watched(client):
    """Add wallets to lists through the API. Returns their ids."""
    def add(address: str, wallet_list: str = "watch", label: str | None = None) -> int:
        response = client.post("/memecoin/wallets", json={"address": address, "list": wallet_list, "label": label})
        assert response.status_code == 201
        return response.json()["id"]
    return add


def test_a_check_turns_new_buys_into_alerts_once(client, watched, fake_rpc, db_session):
    watched(WALLET, "good_dev", label="launch dev")
    fake_rpc["signatures"] = [{"signature": "other"}]
    fake_rpc["transactions"] = {"buy": BUY["transaction"], "other": OTHER["transaction"]}

    first = client.post("/memecoin/watch/check").json()
    assert first == {"wallets_checked": 1, "new_alerts": 0, "errors": {}}  # the starting point

    fake_rpc["signatures"] = [{"signature": "buy"}, {"signature": "other"}]
    assert client.post("/memecoin/watch/check").json()["new_alerts"] == 1
    assert client.post("/memecoin/watch/check").json()["new_alerts"] == 0

    alerts = client.get("/memecoin/alerts").json()
    assert alerts["unseen"] == 1
    alert = alerts["alerts"][0]
    assert (alert["mint"], alert["wallet_list"], alert["wallet_label"], alert["seen"]) == (BOUGHT_MINT, "good_dev", "launch dev", False)
    assert alert["block_time"].endswith(("Z", "+00:00"))


def test_marking_alerts_seen(client, watched, fake_rpc, db_session):
    wallet_id = watched(WALLET)
    db_session.get(models.MemecoinWallet, wallet_id).last_signature = "other"
    db_session.commit()
    fake_rpc["signatures"] = [{"signature": "buy"}, {"signature": "other"}]
    fake_rpc["transactions"] = {"buy": BUY["transaction"]}
    client.post("/memecoin/watch/check")

    assert client.post("/memecoin/alerts/seen").status_code == 204
    assert client.get("/memecoin/alerts").json()["unseen"] == 0


def test_blacklisted_wallets_are_not_watched(client, watched, fake_rpc):
    watched(WALLET, "blacklist")
    assert client.post("/memecoin/watch/check").json()["wallets_checked"] == 0
    assert fake_rpc["calls"] == []


def test_a_failing_wallet_is_reported_and_keeps_its_place(client, watched, monkeypatch, db_session):
    wallet_id = watched(WALLET)

    async def down(client, address, until, limit):
        raise solana_rpc.RpcError("Too many requests for a specific RPC call")

    monkeypatch.setattr(solana_rpc, "signatures", down)
    result = client.post("/memecoin/watch/check").json()
    assert result["errors"] == {WALLET: "RpcError: Too many requests for a specific RPC call"}
    assert db_session.get(models.MemecoinWallet, wallet_id).last_checked_at is None


def test_watch_status(client, watched, fake_rpc):
    watched(WALLET)
    assert client.get("/memecoin/watch").json() == {"wallets": 1, "telegram": False, "last_checked_at": None}
    fake_rpc["signatures"] = [{"signature": "sig"}]
    client.post("/memecoin/watch/check")
    assert client.get("/memecoin/watch").json()["last_checked_at"] is not None


# --- Telegram --------------------------------------------------------------------

@pytest.fixture
def telegram(monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "123:abc")
    monkeypatch.setattr(settings, "TELEGRAM_CHAT_ID", "42")
    sent = []

    async def send(client, text):
        sent.append(text)

    monkeypatch.setattr(watch, "send_telegram", send)
    return sent


def a_new_buy(client, watched, fake_rpc, db_session):
    wallet_id = watched(WALLET, label="whale")
    db_session.get(models.MemecoinWallet, wallet_id).last_signature = "other"
    db_session.commit()
    fake_rpc["signatures"] = [{"signature": "buy"}, {"signature": "other"}]
    fake_rpc["transactions"] = {"buy": BUY["transaction"]}
    return client.post("/memecoin/watch/check").json()


def test_new_alerts_go_to_telegram_when_configured(client, watched, fake_rpc, db_session, telegram):
    a_new_buy(client, watched, fake_rpc, db_session)
    assert len(telegram) == 1
    assert telegram[0].startswith("whale ") and BOUGHT_MINT in telegram[0]
    assert client.get("/memecoin/watch").json()["telegram"] is True


def test_a_telegram_failure_is_reported_but_the_alert_is_kept(client, watched, fake_rpc, db_session, telegram, monkeypatch):
    async def refuse(client, text):
        raise httpx.HTTPStatusError("401", request=httpx.Request("POST", "https://api.telegram.org"), response=httpx.Response(401, text="Unauthorized"))

    monkeypatch.setattr(watch, "send_telegram", refuse)
    result = a_new_buy(client, watched, fake_rpc, db_session)
    assert result["new_alerts"] == 1
    assert result["errors"] == {"telegram": "HTTP 401: Unauthorized"}
    assert client.get("/memecoin/alerts").json()["unseen"] == 1


def test_recording_the_same_find_twice_stores_one_alert(client, watched, db_session):
    # Two checks running at once (the button and the command line) can both see a transaction.
    from app.helpers.memecoin import storage

    wallet_id = watched(WALLET)
    found = [watch.Found("buy", BOUGHT_MINT, 5.0, None)]
    assert len(storage.record_scan(db_session, wallet_id, "buy", found)) == 1
    assert storage.record_scan(db_session, wallet_id, "buy", found) == []
    assert db_session.query(models.MemecoinAlert).count() == 1


def test_an_rpc_429_is_retried_once(monkeypatch):
    requests = []
    answers = [httpx.Response(429, text="Too many requests"), httpx.Response(200, json={"jsonrpc": "2.0", "id": 1, "result": [{"signature": "s"}]})]

    def server(request):
        requests.append(request)
        return answers.pop(0)

    async def no_wait(seconds):
        return None

    monkeypatch.setattr(solana_rpc.asyncio, "sleep", no_wait)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(server)) as client:
            return await solana_rpc.signatures(client, WALLET, until=None, limit=1)

    assert asyncio.run(run()) == [{"signature": "s"}]
    assert len(requests) == 2


def test_an_rpc_error_object_raises(monkeypatch):
    def server(request):
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": 1, "error": {"code": -32015, "message": "Transaction version (2) is not supported"}})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(server)) as client:
            return await solana_rpc.transaction(client, "sig")

    with pytest.raises(solana_rpc.RpcError, match="version"):
        asyncio.run(run())

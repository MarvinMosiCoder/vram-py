"""Route tests for saved reports, wallet lists, and the trade journal.

The app, client, user, and in-memory database fixtures are in conftest.py.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.helpers.memecoin import analyzer, storage

BONK = "bonk-DezXAZ8z"
BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
EPUMP = "epump-7haJedyf"
WALLET = "9AhKqLR67hwapvG8SA2JFXaCshXc9nALJjpKaHZrsbkw"
EVM_ADDRESS = "0x6982508145454Ce325dDbE47a25d4ec3d2311933"


@pytest.fixture
def save(db_session, raw, sources):
    """save(coin, minutes_ago) stores a report built from a saved coin."""
    def build(coin: str, minutes_ago: int = 0):
        report = analyzer.build_report(raw(coin, "rugcheck")["mint"], sources(coin))
        report.checked_at -= timedelta(minutes=minutes_ago)
        return storage.save_report(db_session, report, user_id=1)

    return build


# --- Reports -----------------------------------------------------------------

def test_history_lists_newest_first(client, save):
    save(BONK, minutes_ago=10)
    save(EPUMP, minutes_ago=1)

    rows = client.get("/memecoin/reports").json()
    assert [row["symbol"] for row in rows] == ["e/pump", "Bonk"]
    assert set(rows[0]) == {"id", "address", "chain", "symbol", "name", "verdict", "score", "checked_at"}


def test_history_filters_by_address_and_pages(client, save):
    save(BONK, minutes_ago=3)
    save(BONK, minutes_ago=2)
    save(EPUMP, minutes_ago=1)

    assert len(client.get("/memecoin/reports", params={"address": BONK_MINT}).json()) == 2
    page = client.get("/memecoin/reports", params={"limit": 1, "offset": 1}).json()
    assert len(page) == 1 and page[0]["address"] == BONK_MINT


def test_history_rejects_something_that_is_no_address(client):
    assert client.get("/memecoin/reports", params={"address": "not-an-address"}).status_code == 422
    assert client.get("/memecoin/reports", params={"address": EVM_ADDRESS}).status_code == 200


def test_saved_times_are_marked_as_utc(client, save):
    row = save(BONK)
    checked_at = client.get("/memecoin/reports").json()[0]["checked_at"]

    parsed = datetime.fromisoformat(checked_at.replace("Z", "+00:00"))
    assert parsed.utcoffset() == timedelta(0)
    assert parsed.replace(tzinfo=None) == row.checked_at


def test_a_saved_report_comes_back_whole(client, save):
    row = save(BONK)
    saved = client.get(f"/memecoin/reports/{row.id}").json()

    assert saved["verdict"] == "Watch"
    assert saved["report"]["address"] == BONK_MINT
    assert saved["report"]["assessment"] == row.report["assessment"]


def test_a_missing_report_is_404(client):
    assert client.get("/memecoin/reports/999").status_code == 404


# --- Wallet lists --------------------------------------------------------------

def test_add_list_and_delete_a_wallet(client):
    added = client.post("/memecoin/wallets", json={"address": WALLET, "list": "blacklist", "label": "scam dev", "note": "rugged $XYZ"})
    assert added.status_code == 201
    assert added.json()["label"] == "scam dev"

    assert [w["address"] for w in client.get("/memecoin/wallets").json()] == [WALLET]
    assert client.delete(f"/memecoin/wallets/{added.json()['id']}").status_code == 204
    assert client.get("/memecoin/wallets").json() == []
    assert client.delete(f"/memecoin/wallets/{added.json()['id']}").status_code == 404


def test_a_wallet_is_on_each_list_at_most_once(client):
    client.post("/memecoin/wallets", json={"address": WALLET, "list": "blacklist"})

    again = client.post("/memecoin/wallets", json={"address": WALLET, "list": "blacklist"})
    assert again.status_code == 409
    assert again.json()["detail"] == "This wallet is already on the blacklist"
    # The other list is separate.
    assert client.post("/memecoin/wallets", json={"address": WALLET, "list": "good_dev"}).status_code == 201


def test_wallets_filter_by_list(client):
    client.post("/memecoin/wallets", json={"address": WALLET, "list": "blacklist"})
    client.post("/memecoin/wallets", json={"address": BONK_MINT, "list": "good_dev"})

    assert [w["address"] for w in client.get("/memecoin/wallets", params={"list": "good_dev"}).json()] == [BONK_MINT]


@pytest.mark.parametrize("body", [
    {"address": "0x1234", "list": "blacklist"},
    {"address": WALLET, "list": "friends"},
    {"address": WALLET, "list": "blacklist", "label": "x" * 101},
])
def test_invalid_wallets_are_rejected(client, body):
    assert client.post("/memecoin/wallets", json=body).status_code == 422


# --- Trade journal -------------------------------------------------------------

def open_trade(client, **fields):
    body = {"address": BONK_MINT, "symbol": "Bonk", "entry_price": 0.001, "amount_usd": 50, "entry_reason": "Watch verdict, volume rising"}
    return client.post("/memecoin/trades", json={**body, **fields})


def test_a_new_trade_is_open(client):
    response = open_trade(client)
    assert response.status_code == 201

    trade = response.json()
    assert trade["exit_price"] is None and trade["pnl_pct"] is None
    entered = datetime.fromisoformat(trade["entered_at"].replace("Z", "+00:00"))
    assert abs(datetime.now(timezone.utc) - entered) < timedelta(minutes=1)


def test_closing_a_trade_records_the_exit_and_the_profit(client):
    trade = open_trade(client).json()

    closed = client.patch(f"/memecoin/trades/{trade['id']}", json={"exit_price": 0.002, "exit_reason": "Doubled, took profit"})
    assert closed.status_code == 200
    body = closed.json()
    assert body["pnl_pct"] == pytest.approx(100)
    assert body["exit_reason"] == "Doubled, took profit"
    assert body["exited_at"] is not None


def test_an_exit_price_without_a_reason_is_rejected(client):
    trade = open_trade(client).json()

    response = client.patch(f"/memecoin/trades/{trade['id']}", json={"exit_price": 0.002})
    assert response.status_code == 422
    assert client.get("/memecoin/trades").json()[0]["exit_price"] is None


def test_required_fields_cannot_be_cleared(client):
    trade = open_trade(client).json()
    assert client.patch(f"/memecoin/trades/{trade['id']}", json={"entry_price": None}).status_code == 422


def test_trades_are_private_to_their_user(client, user):
    trade = open_trade(client).json()

    user.id = 2
    assert client.get("/memecoin/trades").json() == []
    assert client.patch(f"/memecoin/trades/{trade['id']}", json={"entry_reason": "mine now"}).status_code == 404
    assert client.delete(f"/memecoin/trades/{trade['id']}").status_code == 404

    user.id = 1
    assert client.delete(f"/memecoin/trades/{trade['id']}").status_code == 204
    assert client.get("/memecoin/trades").json() == []


def test_a_trade_can_point_at_a_saved_report(client, save):
    row = save(BONK)
    assert open_trade(client, report_id=row.id).json()["report_id"] == row.id
    assert open_trade(client, report_id=999).status_code == 422


@pytest.mark.parametrize("fields", [{"entry_price": 0}, {"entry_reason": ""}, {"address": "0x1234"}, {"chain": "pulsechain"}])
def test_invalid_trades_are_rejected(client, fields):
    assert open_trade(client, **fields).status_code == 422

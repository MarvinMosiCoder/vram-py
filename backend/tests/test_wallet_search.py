from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app import models
from app.core.auth import get_current_user

CREATOR = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
OTHER = "So11111111111111111111111111111111111111112"
EVM = "0x" + "aB" * 20
OWNER = "0x" + "cD" * 20
TOKEN = "0x" + "12" * 20


def add_report(db, address=OTHER, chain="solana", creator=CREATOR, owner=None, history=None, days=0):
    checked = datetime(2026, 9, 28) + timedelta(days=days)
    row = models.MemecoinReport(
        address=address, chain=chain, name="Example", symbol="EX", verdict="Watch", score=0,
        checked_at=checked, created_at=checked, adm_user_id=1,
        report={"safety": {"creator": creator, "owner": owner, "creator_tokens": history}, "market": {"market_cap": 100000 + days}},
    )
    db.add(row)
    db.commit()
    return row


def test_creator_history_deduplicates_and_keeps_latest_observation(client, db_session):
    history = [{"mint": CREATOR, "market_cap": 250000, "created_at": "2026-09-01T00:00:00Z"}, {"mint": OTHER}]
    add_report(db_session, history=history)
    latest = add_report(db_session, history=history, days=1)
    response = client.get(f"/memecoin/wallet-tokens/solana/{CREATOR}")
    assert response.status_code == 200
    body = response.json()
    assert body["coverage"] == "saved_reports" and body["total"] == 2
    own, historic = body["tokens"]
    assert own["address"] == OTHER and own["report_id"] == latest.id
    assert own["market_cap"] == 100001
    assert historic["address"] == CREATOR and historic["source"] == "RugCheck creator history"
    assert historic["created_at"] == "2026-09-01T00:00:00Z"
    page = client.get(f"/memecoin/wallet-tokens/solana/{CREATOR}?limit=1&offset=1").json()
    assert page["total"] == 2 and len(page["tokens"]) == 1
    assert page["tokens"][0] == historic


def test_owner_is_not_creator_and_evm_is_case_insensitive_chain_scoped(client, db_session):
    add_report(db_session, address=TOKEN, chain="ethereum", creator=EVM, owner=OWNER, history=[{"mint": OTHER}])
    add_report(db_session, address=TOKEN, chain="base", creator=EVM, owner=OWNER)
    created = client.get(f"/memecoin/wallet-tokens/ethereum/{EVM.lower()}").json()
    assert created["total"] == 1 and created["address"] == EVM.lower()
    assert client.get(f"/memecoin/wallet-tokens/ethereum/{OWNER}").json()["total"] == 0
    owned = client.get(f"/memecoin/wallet-tokens/ethereum/{OWNER}?relationship=owner").json()
    assert owned["total"] == 1 and owned["tokens"][0]["address"] == TOKEN


def test_unknown_wallet_returns_empty_and_null_safety_is_ignored(client, db_session):
    row = add_report(db_session)
    row.report = {"safety": None}
    db_session.commit()
    response = client.get(f"/memecoin/wallet-tokens/solana/{CREATOR}")
    assert response.status_code == 200 and response.json()["tokens"] == []


@pytest.mark.parametrize("path", [
    f"ethereum/{CREATOR}", f"solana/{EVM}", f"unknown/{CREATOR}",
    f"solana/{CREATOR}?relationship=owner", f"solana/{CREATOR}?relationship=holder",
    f"solana/{CREATOR}?limit=101", f"solana/{CREATOR}?offset=-1",
])
def test_rejects_invalid_queries(client, path):
    assert client.get(f"/memecoin/wallet-tokens/{path}").status_code == 422


def test_wallet_search_requires_authentication(app):
    del app.dependency_overrides[get_current_user]
    assert TestClient(app).get(f"/memecoin/wallet-tokens/solana/{CREATOR}").status_code == 401

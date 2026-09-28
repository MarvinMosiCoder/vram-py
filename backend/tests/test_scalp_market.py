import httpx
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.helpers.memecoin import dexscreener

MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
PATH = f"/memecoin/market/solana/{MINT}"


def pair(liquidity, cap, volume):
    return {"chainId": "solana", "baseToken": {"address": MINT}, "liquidity": {"usd": liquidity}, "marketCap": cap, "fdv": 999999, "volume": {"h1": volume, "m5": 5000}, "txns": {"m5": {"buys": 30, "sells": 20}}, "priceChange": {"m5": 2, "h1": 10}}


def test_metrics_follow_deepest_pool_and_preserve_unknowns():
    market = dexscreener.token_market([pair(1000, 1, 2), pair(50000, 100000, 50000)], MINT)
    assert (market.market_cap, market.volume_1h, market.volume_5m) == (100000, 50000, 5000)
    assert (market.buys_5m, market.sells_5m, market.price_change_5m) == (30, 20, 2)
    assert market.total_liquidity_usd == 51000
    missing = dexscreener.summarize_pair({"chainId": "solana", "baseToken": {"address": MINT}, "fdv": 1000000})
    assert missing.market_cap is None and missing.volume_5m is None and missing.buys_5m is None


def test_market_refresh_is_fresh_and_does_not_collect_safety(client, monkeypatch):
    calls = []
    async def fetch(client, chain, address):
        calls.append((chain, address))
        return [pair(50000, 100000, 50000)]
    monkeypatch.setattr(dexscreener, "fetch_token_pairs", fetch)
    for _ in range(2):
        response = client.get(PATH)
        assert response.status_code == 200
        assert response.json()["market"]["market_cap"] == 100000
        assert response.json()["fetched_at"].endswith("Z")
    assert calls == [("solana", MINT)] * 2


def test_market_errors_and_validation(client, monkeypatch):
    async def fail(*args):
        raise httpx.ConnectTimeout("timeout")
    monkeypatch.setattr(dexscreener, "fetch_token_pairs", fail)
    assert client.get(PATH).status_code == 502
    assert client.get(f"/memecoin/market/ethereum/{MINT}").status_code == 422
    assert client.get(f"/memecoin/market/unsupported/{MINT}").status_code == 422


def test_market_requires_login(app):
    del app.dependency_overrides[get_current_user]
    assert TestClient(app).get(PATH).status_code == 401

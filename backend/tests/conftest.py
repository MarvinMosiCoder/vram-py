"""Shared test helpers: load saved API responses from tests/fixtures/."""
import json
from pathlib import Path

import pytest

from app.helpers.memecoin import dexscreener, rugcheck, rules

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def read_fixture(coin: str, source: str):
    return json.loads((FIXTURES_DIR / coin / f"{source}.json").read_text(encoding="utf-8"))


@pytest.fixture
def raw():
    """raw("bonk-DezXAZ8z", "search") returns that saved response."""
    return read_fixture


@pytest.fixture
def evidence():
    """evidence("bonk-DezXAZ8z", age_hours=2) builds rule input from a saved coin.

    Age is computed from the current time, so a saved coin keeps getting older.
    Tests pass the age they mean instead of depending on the clock.
    """
    def build(coin: str, age_hours: float) -> rules.Evidence:
        safety = rugcheck.summarize_report(read_fixture(coin, "rugcheck"))
        market = dexscreener.token_market(read_fixture(coin, "dexscreener"), safety.mint)
        market = market.model_copy(update={"age_hours": age_hours})
        return rules.Evidence(market=market, safety=safety)

    return build

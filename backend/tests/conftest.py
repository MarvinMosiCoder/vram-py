"""Shared test helpers: saved API responses from tests/fixtures/, and the
memecoin router running alone against an in-memory database."""
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.api.admin import memecoin
from app.core.auth import get_current_user
from app.core.database import Base, get_db
from app.helpers.memecoin import analyzer, dexscreener, goplus, rugcheck, rules, web

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def read_fixture(coin: str, source: str):
    return json.loads((FIXTURES_DIR / coin / f"{source}.json").read_text(encoding="utf-8"))


def goplus_record(coin: str) -> tuple[str, dict] | None:
    """The saved GoPlus answer for an EVM coin: (lower-case address, record)."""
    saved = read_optional(coin, "goplus")
    return next(iter(saved["result"].items())) if saved else None


def read_optional(coin: str, source: str):
    """A saved response, or None for a lookup the coin never needed (no rdap.json
    for a coin without a website of its own)."""
    path = FIXTURES_DIR / coin / f"{source}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


@pytest.fixture
def raw():
    """raw("bonk-DezXAZ8z", "search") returns that saved response."""
    return read_fixture


@pytest.fixture
def sources():
    """sources("bonk-DezXAZ8z", rugcheck=httpx.ConnectTimeout("")) returns what
    collect() would for a saved coin, with any source replaced."""
    def build(coin: str, **replace) -> analyzer.Sources:
        evm = goplus_record(coin)
        saved = analyzer.Sources(
            pairs=read_fixture(coin, "dexscreener"),
            rugcheck=None if evm else read_fixture(coin, "rugcheck"),
            goplus=evm[1] if evm else None,
            rdap=read_optional(coin, "rdap"),
            wayback=read_optional(coin, "wayback"),
        )
        for name, value in replace.items():
            setattr(saved, name, value)
        return saved

    return build


@pytest.fixture
def evidence():
    """evidence("bonk-DezXAZ8z", age_hours=2) builds rule input from a saved coin.

    Ages are computed from the current time, so a saved coin and its domain keep
    getting older. Tests pass the pool age they mean, and the domain age when
    they depend on it, instead of relying on the clock.
    """
    def build(coin: str, age_hours: float, domain_age_days: float | None = None) -> rules.Evidence:
        evm = goplus_record(coin)
        if evm:
            safety = goplus.summarize_security(evm[1], evm[0])
        else:
            safety = rugcheck.summarize_report(read_fixture(coin, "rugcheck"))
        market = dexscreener.token_market(read_fixture(coin, "dexscreener"), safety.mint)
        market = market.model_copy(update={"age_hours": age_hours})
        web_data = web.summarize_web(market, read_optional(coin, "rdap"), read_optional(coin, "wayback"))
        if domain_age_days is not None:
            web_data = web_data.model_copy(update={"domain_age_days": domain_age_days})
        return rules.Evidence(market=market, safety=safety, web=web_data, family="evm" if evm else "solana")

    return build


@pytest.fixture(autouse=True)
def empty_cache(monkeypatch):
    """Each test starts without cached reports, or one test's Bonk would answer the next."""
    monkeypatch.setattr(analyzer, "_cache", {})


@pytest.fixture
def db_session():
    """A fresh in-memory SQLite database holding only the memecoin tables.

    Tests never reach the configured Postgres database. StaticPool keeps one
    connection, so the TestClient's worker thread sees the same database.
    """
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    tables = [
        models.MemecoinReport.__table__,
        models.MemecoinWallet.__table__,
        models.MemecoinTrade.__table__,
        models.MemecoinAlert.__table__,
    ]
    Base.metadata.create_all(engine, tables=tables)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture
def user():
    """The signed-in user. Set user.id to act as someone else."""
    return SimpleNamespace(id=1, id_adm_role=1)


@pytest.fixture
def app(db_session, user):
    """The memecoin router alone: no auth middleware, login and database replaced."""
    app = FastAPI()
    app.include_router(memecoin.router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db_session
    return app


@pytest.fixture
def client(app):
    return TestClient(app)

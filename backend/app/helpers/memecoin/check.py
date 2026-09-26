"""Command-line check: search a coin, pick it, and print everything collected.

Run from backend/:  python -m app.helpers.memecoin.check <name or address>
Solana only for now, because RugCheck only covers Solana mints.
"""
import argparse
import asyncio
import json
import re
import sys
import time
from pathlib import Path

import httpx

from app import schemas
from app.helpers.memecoin import analyzer,dexscreener, rugcheck, rules

# backend/tests/fixtures: this file is backend/app/helpers/memecoin/check.py.
FIXTURES_DIR = Path(__file__).resolve().parents[3] / "tests" / "fixtures"


async def search(query: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        return await dexscreener.search_pairs(client, query)


def save_fixtures(token: schemas.MarketData, responses: dict[str, object]) -> None:
    """Write each raw response to tests/fixtures/<symbol>-<address>/<source>.json."""
    slug = re.sub(r"[^a-z0-9]+", "", (token.symbol or "").lower()) or "token"
    folder = FIXTURES_DIR / f"{slug}-{token.address[:8]}"
    folder.mkdir(parents=True, exist_ok=True)

    for source, data in responses.items():
        if isinstance(data, Exception):
            print(f"Not saved: {source} (the request failed)")
            continue
        path = folder / f"{source}.json"
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Saved {path.relative_to(FIXTURES_DIR.parents[1])} ({path.stat().st_size / 1024:,.0f} KB)")


def money(value: float | None) -> str:
    return "-" if value is None else f"${value:,.0f}"


def price_text(value: float | None) -> str:
    return "-" if value is None else f"${value:.10f}".rstrip("0").rstrip(".")


def age_text(hours: float | None) -> str:
    if hours is None:
        return "?"
    return f"{hours:.1f}h" if hours < 24 else f"{hours / 24:.0f}d"


def pct_text(value: float | None) -> str:
    return "?" if value is None else f"{value:.1f}%"


def authority_text(authority: str | None) -> str:
    return "renounced" if authority is None else f"ENABLED ({authority})"


def pick_token(tokens: list[schemas.MarketData]) -> schemas.MarketData:
    """Ask which token was meant. Command line only: the web page will use clicks."""
    if len(tokens) == 1:
        return tokens[0]

    for number, token in enumerate(tokens, start=1):
        print(
            f"{number:>2}. {token.symbol:<10} {token.address:<44} "
            f"liq {money(token.total_liquidity_usd):>13}  "
            f"vol24h {money(token.total_volume_24h):>13}  "
            f"pools {token.pools}"
        )

    while True:
        answer = input(f"Pick 1-{len(tokens)} (Enter = 1): ").strip()
        if not answer:
            return tokens[0]
        if answer.isdigit() and 1 <= int(answer) <= len(tokens):
            return tokens[int(answer) - 1]
        print("Not a number from the list, try again.")

def print_assessment(assessment: schemas.Assessment) -> None:
    print(f"\nVerdict: {assessment.verdict.upper()}  (risk score {assessment.score}/100)")
    if assessment.verdict == "Watch":
        print("  No hard fails. This is a risk rating, not a buy signal.")
    for finding in assessment.findings:
        label = "FAIL" if finding.severity == "fail" else "warn"
        print(f"  [{label}] {finding.message}")
    if assessment.unchecked:
        print(f"  Not checked (data missing): {', '.join(assessment.unchecked)}")
        if rules.FAIL_RULES & set(assessment.unchecked):
            print("  Hard-fail rules went unchecked, so the verdict is at least High risk.")


def print_market(market: schemas.MarketData) -> None:
    print(f"  Main pool:      {market.pair_address} ({market.dex})")
    print(f"  Price:          {price_text(market.price_usd)}")
    print(f"  Liquidity:      {money(market.total_liquidity_usd)} across {market.pools} pools")
    print(f"  Volume 24h:     {money(market.total_volume_24h)}")
    print(f"  Buys/sells 24h: {market.buys_24h} / {market.sells_24h} (main pool)")
    print(f"  Main pool age:  {age_text(market.age_hours)}")
    print(f"  {market.url}")


def print_safety(s: schemas.SafetyData) -> None:
    print(f"  Mint authority:   {authority_text(s.mint_authority)}")
    print(f"  Freeze authority: {authority_text(s.freeze_authority)}")
    print(f"  LP locked/burned: {pct_text(s.lp_locked_pct)}")
    print(f"  Holders:          {s.total_holders or 0:,}")
    print(f"  Top 10 hold:      {pct_text(s.top10_pct)} ({s.top10_insiders} insiders, pools excluded)")
    print(f"  Creator holds:    {pct_text(s.creator_pct)}")
    print(f"  Insider wallets:  {s.insiders_detected}")
    print(f"  Transfer fee:     {pct_text(s.transfer_fee_pct)}")
    print(f"  Mutable metadata: {'yes' if s.mutable_metadata else 'no'}")
    print(f"  Launchpad:        {s.launchpad or '-'}")
    print(f"  Rugged:           {'YES' if s.rugged else 'no'}")
    print(f"  RugCheck score:   {s.rugcheck_score} / 100 (higher = riskier)")
    print("  Risks:" if s.risks else "  Risks:            none reported")
    for risk in s.risks:
        print(f"    [{risk.level}] {risk.name}: {risk.description}")

    print("  Top holders:")
    for number, holder in enumerate(s.top_holders, start=1):
        tags = []
        if holder.label:
            tags.append(holder.label)
        if holder.insider:
            tags.append("insider")
        print(f"    {number:>2}. {holder.pct:5.2f}%  {holder.owner}  {', '.join(tags)}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Check a Solana memecoin.")
    parser.add_argument("query", nargs="+", help="coin name or mint address")
    parser.add_argument("--save", action="store_true", help="save the raw API responses to tests/fixtures/")
    args = parser.parse_args()
    query = " ".join(args.query)

    try:
        search_results = asyncio.run(search(query))
    except httpx.HTTPError as error:
        print(f"DexScreener search failed: {analyzer.describe(error)}")
        sys.exit(1)

    tokens = [t for t in dexscreener.group_tokens(search_results) if t.chain == "solana"]
    if not tokens:
        print(f"No Solana token found for {query!r}")
        return

    # Picking happens between the two asyncio.run calls: input() blocks, and
    # blocking inside async code would freeze every request in flight.
    token = pick_token(tokens)

    started = time.perf_counter()
    pairs, rugcheck_report = asyncio.run(analyzer.collect(token.address))
    elapsed = time.perf_counter() - started
    coin = analyzer.build_report(token.address, pairs, rugcheck_report)

    print()
    print(f"{token.name} ({token.symbol})  {token.address}")
    print(f"Collected in {elapsed:.1f}s")
    print_assessment(coin.assessment)

    print("\nMarket (DexScreener)")
    if "dexscreener" in coin.errors:
        print(f"  unavailable: {coin.errors['dexscreener']}")
    elif coin.market is None:
        print("  no pairs found")
    else:
        print_market(coin.market)

    print("\nSafety (RugCheck)")
    if coin.safety is None:
        print(f"  unavailable: {coin.errors['rugcheck']}")
    else:
        print_safety(coin.safety)

    if args.save:
        print()
        save_fixtures(token, {"search": search_results, "dexscreener": pairs, "rugcheck": rugcheck_report})


if __name__ == "__main__":
    main()

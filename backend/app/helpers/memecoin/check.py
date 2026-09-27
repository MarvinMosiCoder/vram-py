"""Command-line check: search a coin, pick it, and print everything collected.

Run from backend/:  python -m app.helpers.memecoin.check <name or address> [--chain ethereum]
Covers the chains in chains.py: RugCheck for Solana, GoPlus for EVM chains.
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
from app.helpers.memecoin.chains import CHAINS

# backend/tests/fixtures: this file is backend/app/helpers/memecoin/check.py.
FIXTURES_DIR = Path(__file__).resolve().parents[3] / "tests" / "fixtures"


async def search(query: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        return await dexscreener.search_pairs(client, query)


def save_fixtures(token: schemas.MarketData, responses: dict[str, object]) -> None:
    """Write each raw response to tests/fixtures/<symbol>-<address>/<source>.json.
    A source that was not needed (None) is skipped."""
    slug = re.sub(r"[^a-z0-9]+", "", (token.symbol or "").lower()) or "token"
    folder = FIXTURES_DIR / f"{slug}-{token.address[:8]}"
    folder.mkdir(parents=True, exist_ok=True)

    for source, data in responses.items():
        if data is None:
            continue
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


def count_text(value: int | None) -> str:
    return "?" if value is None else f"{value:,}"


def yes_no_text(value: bool | None) -> str:
    return "?" if value is None else "yes" if value else "no"


def authority_text(authority: str | None) -> str:
    return "renounced" if authority is None else f"ENABLED ({authority})"


def pick_token(tokens: list[schemas.MarketData]) -> schemas.MarketData:
    """Ask which token was meant. Command line only: the web page will use clicks."""
    if len(tokens) == 1:
        return tokens[0]

    for number, token in enumerate(tokens, start=1):
        print(
            f"{number:>2}. {token.chain:<9} {token.symbol:<10} {token.address:<44} "
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
        elif assessment.verdict == "High risk" and assessment.score < rules.HIGH_RISK_SCORE:
            print("  Unchecked warnings count as flagged for the verdict, so it is High risk.")


def print_market(market: schemas.MarketData) -> None:
    print(f"  Main pool:      {market.pair_address} ({market.dex})")
    print(f"  Price:          {price_text(market.price_usd)}")
    print(f"  Liquidity:      {money(market.total_liquidity_usd)} across {market.pools} pools")
    print(f"  Volume 24h:     {money(market.total_volume_24h)}")
    print(f"  Buys/sells 24h: {market.buys_24h} / {market.sells_24h} (main pool)")
    print(f"  Main pool age:  {age_text(market.age_hours)}")
    print(f"  {market.url}")


def flag_text(value: bool | None, danger: str, safe: str) -> str:
    return "?" if value is None else danger if value else safe


def print_evm_safety(s: schemas.SafetyData) -> None:
    owner = "renounced" if s.owner_renounced else (s.owner or "?")
    print(f"  Honeypot:         {flag_text(s.honeypot, 'YES, may not be sellable', 'no')}")
    print(f"  Buy / sell tax:   {pct_text(s.buy_tax_pct)} / {pct_text(s.sell_tax_pct)}")
    print(f"  Source verified:  {flag_text(s.open_source, 'yes', 'NO')}")
    print(f"  Owner:            {owner}")
    print(f"  Owner can mint:   {flag_text(s.owner_can_mint, 'YES', 'no')}")
    print(f"  Changes balances: {flag_text(s.owner_can_change_balances, 'YES', 'no')}")
    print(f"  Pause / blacklist:{flag_text(s.transfers_pausable, ' pause', ' -')} /{flag_text(s.can_blacklist, ' blacklist', ' -')}")
    print(f"  Proxy / hidden:   {flag_text(s.proxy, 'upgradeable', 'no')} / {flag_text(s.hidden_owner, 'hidden owner', 'no')}")
    print(f"  LP locked/burned: {pct_text(s.lp_locked_pct)}")
    print(f"  Holders:          {count_text(s.total_holders)}")
    print(f"  Top 10 hold:      {pct_text(s.top10_pct)} (pools and burn addresses excluded)")
    print(f"  Creator:          {s.creator or '?'} holds {pct_text(s.creator_pct)}")
    print(f"  Creator honeypots:{flag_text(s.creator_made_honeypots, ' YES, made honeypots before', ' none known')}")


def print_safety(s: schemas.SafetyData) -> None:
    print(f"  Mint authority:   {authority_text(s.mint_authority)}")
    print(f"  Freeze authority: {authority_text(s.freeze_authority)}")
    print(f"  LP locked/burned: {pct_text(s.lp_locked_pct)}")
    print(f"  Holders:          {count_text(s.total_holders)}")
    print(f"  Top 10 hold:      {pct_text(s.top10_pct)} ({count_text(s.top10_insiders)} insiders, pools excluded)")
    print(f"  Creator holds:    {pct_text(s.creator_pct)}")
    print(f"  Insider wallets:  {s.insiders_detected}")
    print(f"  Transfer fee:     {pct_text(s.transfer_fee_pct)}")
    print(f"  Mutable metadata: {yes_no_text(s.mutable_metadata)}")
    print(f"  Launchpad:        {s.launchpad or '-'}")
    print(f"  Rugged:           {'YES' if s.rugged else 'no'}")
    print(f"  RugCheck score:   {s.rugcheck_score} / 100 (higher = riskier)")
    print("  Risks:" if s.risks else "  Risks:            none reported")
    for risk in s.risks:
        print(f"    [{risk.level}] {risk.name}: {risk.description}")

    if s.linked_wallets_pct is not None:
        print(f"  Linked wallets:   {pct_text(s.linked_wallets_pct)} held by {len(s.insider_networks)} transfer-linked groups")
    print("  Top holders:")
    for number, holder in enumerate(s.top_holders, start=1):
        tags = []
        if holder.label:
            tags.append(holder.label)
        if holder.insider:
            tags.append("insider")
        print(f"    {number:>2}. {holder.pct:5.2f}%  {holder.owner}  {', '.join(tags)}")


def print_creator(s: schemas.SafetyData) -> None:
    if s.creator_tokens is None:
        print("  Creator unknown, so no launch history")
        return
    dead = sum(1 for t in s.creator_tokens if t.market_cap is not None and t.market_cap < rules.DEAD_MARKET_CAP_USD)
    print(f"  Other tokens:     {len(s.creator_tokens)} ({dead} worth under {money(rules.DEAD_MARKET_CAP_USD)})")
    for token in s.creator_tokens[:5]:
        created = token.created_at.strftime("%Y-%m-%d %H:%M") if token.created_at else "?"
        print(f"    {created}  {money(token.market_cap):>10}  {token.mint}")


def print_web(market: schemas.MarketData, w: schemas.WebData | None) -> None:
    print(f"  Website:          {market.websites[0] if market.websites else 'none listed'}")
    if w and w.website:
        if w.hosted:
            print(f"  Domain:           {w.domain} (a shared host, age not checked)")
        else:
            registered = w.domain_registered_at.strftime("%Y-%m-%d") if w.domain_registered_at else "?"
            age = age_text(w.domain_age_days * 24) if w.domain_age_days is not None else "?"
            print(f"  Domain:           {w.domain}, registered {registered} ({age} ago)")
        if w.wayback_first_at:
            wayback = w.wayback_first_at.strftime("%Y-%m-%d")
        else:
            wayback = f"unavailable: {w.wayback_error}" if w.wayback_error else "none"
        print(f"  First Wayback:    {wayback}")
    socials = ", ".join(f"{social.type or 'link'} {social.url}" for social in market.socials) or "none listed"
    print(f"  Socials:          {socials}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Check a Solana memecoin.")
    parser.add_argument("query", nargs="+", help="coin name or token address")
    parser.add_argument("--chain", choices=sorted(CHAINS), help="only this chain")
    parser.add_argument("--save", action="store_true", help="save the raw API responses to tests/fixtures/")
    args = parser.parse_args()
    query = " ".join(args.query)

    try:
        search_results = asyncio.run(search(query))
    except httpx.HTTPError as error:
        print(f"DexScreener search failed: {analyzer.describe(error)}")
        sys.exit(1)

    wanted = {args.chain} if args.chain else set(CHAINS)
    tokens = [t for t in dexscreener.group_tokens(search_results) if t.chain in wanted]
    if not tokens:
        print(f"No token on {args.chain or 'a supported chain'} found for {query!r}")
        return

    # Picking happens between the two asyncio.run calls: input() blocks, and
    # blocking inside async code would freeze every request in flight.
    token = pick_token(tokens)

    started = time.perf_counter()
    sources = asyncio.run(analyzer.collect(token.address, token.chain))
    elapsed = time.perf_counter() - started
    coin = analyzer.build_report(token.address, sources, chain=token.chain)

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

    evm = CHAINS[token.chain].family == "evm"
    source = "goplus" if evm else "rugcheck"
    print(f"\nSafety ({'GoPlus' if evm else 'RugCheck'})")
    if coin.safety is None:
        print(f"  unavailable: {coin.errors.get(source, 'no data')}")
    elif evm:
        print_evm_safety(coin.safety)
    else:
        print_safety(coin.safety)
        print("\nCreator history (RugCheck)")
        print_creator(coin.safety)

    if coin.market is not None:
        print("\nWebsite and socials")
        print_web(coin.market, coin.web)
        if "rdap" in coin.errors:
            print(f"  Domain lookup failed: {coin.errors['rdap']}")

    if args.save:
        print()
        save_fixtures(token, {
            "search": search_results,
            "dexscreener": sources.pairs,
            "rugcheck": sources.rugcheck,
            "goplus": sources.goplus,
            "rdap": sources.rdap,
            "wayback": sources.wayback,
        })


if __name__ == "__main__":
    main()

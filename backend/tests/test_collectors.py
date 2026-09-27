"""Collector tests: parse saved responses, no network."""
from app.helpers.memecoin import dexscreener, rugcheck

BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"


def test_search_puts_the_most_traded_token_first(raw):
    # The same search returns copies claiming millions in liquidity with no trading.
    tokens = dexscreener.group_tokens(raw("bonk-DezXAZ8z", "search"))
    assert tokens[0].address == BONK_MINT


def test_pools_are_not_counted_as_holders(raw):
    report = raw("epump-7haJedyf", "rugcheck")
    safety = rugcheck.summarize_report(report)
    listed_top10 = sum(holder["pct"] for holder in report["topHolders"][:10])

    assert all(holder.label != "AMM" for holder in safety.top_holders)
    assert safety.top10_pct < listed_top10


def test_missing_holder_list_is_unknown_not_zero(raw):
    report = {**raw("epump-7haJedyf", "rugcheck"), "topHolders": None}
    assert rugcheck.summarize_report(report).top10_pct is None


# --- Creator history, linked wallets, and links (Phases 7-8) ---------------------

def test_websites_and_socials_come_from_dexscreener(raw):
    market = dexscreener.token_market(raw("bonk-DezXAZ8z", "dexscreener"), BONK_MINT)
    assert market.websites == ["https://www.bonkcoin.com"]
    assert {social.type for social in market.socials} == {"twitter", "telegram", "discord"}


def test_links_are_merged_across_pools_without_repeats(raw):
    pairs = raw("bonk-DezXAZ8z", "dexscreener")
    # Only a shallow pool lists an extra site; the deepest pool still supplies the fields.
    pairs[-1] = {**pairs[-1], "info": {**pairs[-1]["info"], "websites": [{"url": "https://extra.example"}]}}
    market = dexscreener.token_market(pairs, BONK_MINT)
    assert market.websites == ["https://www.bonkcoin.com", "https://extra.example"]
    assert len(market.socials) == 3


def test_creator_history_lists_the_other_tokens(raw):
    safety = rugcheck.summarize_report(raw("stonkwheel-FAvikGwx", "rugcheck"))
    assert len(safety.creator_tokens) == 50
    assert safety.mint not in {token.mint for token in safety.creator_tokens}
    assert safety.creator_tokens[0].created_at.year == 2026


def test_the_coin_itself_is_not_part_of_its_creator_history(raw):
    report = raw("stonkwheel-FAvikGwx", "rugcheck")
    own = {"mint": report["mint"], "marketCap": 500, "createdAt": "2026-09-26T08:00:00Z"}
    safety = rugcheck.summarize_report({**report, "creatorTokens": [own, *report["creatorTokens"]]})
    assert len(safety.creator_tokens) == 50


def test_creator_history_is_empty_or_unknown(raw):
    # RugCheck sends null for a known creator with no other tokens...
    assert rugcheck.summarize_report(raw("epump-7haJedyf", "rugcheck")).creator_tokens == []
    # ...and names no creator at all for FLUFFS, so its history is unknown.
    assert rugcheck.summarize_report(raw("fluffs-2Kjgagqi", "rugcheck")).creator_tokens is None


def test_linked_wallets_share_of_supply(raw):
    report = raw("stonkwheel-FAvikGwx", "rugcheck")
    safety = rugcheck.summarize_report(report)
    assert safety.insider_networks[0].size == 6
    assert round(safety.linked_wallets_pct, 2) == 0.19
    assert rugcheck.summarize_report({**report, "token": {}}).linked_wallets_pct is None

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

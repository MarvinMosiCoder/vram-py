# Memecoin analyzer

A risk checker for Solana memecoins, built inside this backend in phases. The
strategy notes and the phase plan are in [memecoin-strat.md](../../memecoin-strat.md)
(sections 9 and 10). This guide covers what is implemented; the plan covers
what comes next. The output is a risk picture, not investment advice: a coin can
pass every check and still go to zero.

## Status

| Phase | State |
| --- | --- |
| 1. Collect coin data | Done: command-line collectors for DexScreener and RugCheck |
| 2. Rule engine | Done: rules as data, risk score, verdict, pytest suite |
| 3. API | In progress: shared analyzer core and both routes registered; route tests, caching, and rate-limit handling not done |
| 4-9. Page, AI report, storage, tracking | Not started |

`frontend-next/app/(admin)/memecoin/page.tsx` is an empty placeholder with no
default export, which Next.js requires of a page; write or remove it before
running `npm run build`.

## Source files

| File | Responsibility |
| --- | --- |
| `backend/app/helpers/memecoin/dexscreener.py` | Search and token-pair requests, pool summaries, grouping pools into tokens |
| `backend/app/helpers/memecoin/rugcheck.py` | Report request, LP lock, creator share, top holders, safety summary |
| `backend/app/helpers/memecoin/rules.py` | Rule list, thresholds, evaluation, risk score, verdict |
| `backend/app/helpers/memecoin/analyzer.py` | `collect`, `describe`, `build_report`, `analyze`: the core shared by the command line and the API |
| `backend/app/helpers/memecoin/common.py` | `dig` for nested lookups that return `None` instead of raising |
| `backend/app/helpers/memecoin/check.py` | Command line: search, pick, verdict, printing, `--save` |
| `backend/app/api/admin/memecoin.py` | `/memecoin/search` and `/memecoin/analyze/{chain}/{address}` |
| `backend/app/schemas/admin/memecoin.py` | `PoolData`, `MarketData`, `Holder`, `Risk`, `SafetyData`, `Finding`, `Assessment`, `CoinReport`, re-exported from `app.schemas` |
| `backend/tests/` | `conftest.py`, `test_rules.py`, `test_collectors.py`, `test_analyzer.py`, and the saved responses in `fixtures/` |
| `backend/pytest.ini` | Test paths, import path, and a filter for older schemas' deprecation warnings |

The fetch functions (`search_pairs`, `fetch_token_pairs`, `fetch_report`) are
async and return raw JSON. The pure functions (`summarize_pair`, `group_tokens`,
`token_market`, `summarize_report`, `assess`, `build_report`) turn that JSON into
models and a verdict. `check.py` and the API router are two front-ends over
`analyzer.py`, so both build a report the same way. Only `check.py` prints.

## Run a check

From `backend/` with the virtual environment active:

```powershell
python -m app.helpers.memecoin.check <name or mint address>
python -m app.helpers.memecoin.check <name or mint address> --save
```

- A name lists the matching Solana tokens and asks which one to check; Enter
  picks the first. A search with a single match skips the question.
- The output starts with the verdict, risk score, and red flags, followed by the
  Market and Safety sections they were computed from.
- Other chains are filtered out, because RugCheck only covers Solana mints.
- Both APIs are public, so no key is needed. Nothing is written to the database.
- Use `-m` from `backend/` so the `app.` imports resolve. `--help` lists the options.

## API

Both routes are in `backend/app/api/admin/memecoin.py`, included in `routers.py`
before the dynamic module router, which would otherwise match `/memecoin/...`.
They require a signed-in user: the auth middleware returns 401 without a bearer
token, and `Depends(get_current_user)` marks them as protected in `/docs`. Both
call DexScreener and RugCheck on every request; nothing is cached or stored yet.

| Method and path | Parameters | Response |
| --- | --- | --- |
| `GET /memecoin/search` | `q`: 2-100 characters | `list[MarketData]`, Solana tokens only, most traded first |
| `GET /memecoin/analyze/{chain}/{address}` | `chain`: only `solana`; `address`: base58, 32-44 characters | `CoinReport` |

| Status | Cause |
| --- | --- |
| 401 | No or invalid bearer token |
| 422 | `q` missing or too short, a chain other than `solana`, or an address that is not base58 (for example an EVM `0x...` address). Rejected before any external request |
| 502 | `search` only: DexScreener failed; `detail` gives the reason |

`analyze` does not fail when a source does. `CoinReport.errors` maps a failed
source to its reason, for example `{"rugcheck": "ConnectTimeout"}`, its section
is `None`, and the rules report its checks as unchecked. `market` can also be
`None` with no error when DexScreener has no pairs for the mint. `checked_at` is
the UTC time the sources were fetched.

The routes were checked against the full application with the login and the
external APIs replaced by saved data: search and analyze returned 200, a wrong
chain and an EVM address returned 422, and a request without a token returned
401. They have not yet been exercised with a real login on the running server.
To try them, start the backend on port 8080, open `http://localhost:8080/docs`,
and use Authorize with an admin email and password.

## Data sources

| Source | Endpoint | Notes |
| --- | --- | --- |
| DexScreener search | `GET https://api.dexscreener.com/latest/dex/search?q=<query>` | Returns pools, not tokens; at most 30 |
| DexScreener token pairs | `GET https://api.dexscreener.com/token-pairs/v1/{chain}/{address}` | Also capped at 30; `/tokens/v1` returns a single pair |
| RugCheck report | `GET https://api.rugcheck.xyz/v1/tokens/{mint}/report` | About 10 KB for a new coin and 2.5 MB for Bonk, which lists every pool. An invalid mint returns HTTP 400 with `{"error": ...}` |

Timeouts are `TIMEOUT_SECONDS` in each module: 10 seconds for DexScreener and 30
for RugCheck. Every DexScreener endpoint stops at 30 pairs, so pool counts and
totals are a floor for large coins. RugCheck's `totalMarketLiquidity` covers
every pool it has indexed (1,285 for Bonk). New coins usually have one to three
pools. RugCheck answered HTTP 429 when 25 reports were requested at once.

## How values are derived

### Market (DexScreener)

- `group_tokens` keys pools by `(chain, address)`, since the same EVM address
  can be a different token on another chain. The deepest pool supplies the
  token's fields; `pools`, `total_liquidity_usd`, and `total_volume_24h` add up
  every pool.
- Tokens are sorted by 24-hour volume, not liquidity. Liquidity is easy to
  fake: in a `bonk` search, an Ethereum copy reported $384M of liquidity and
  $0.01 of daily volume, and sorting by liquidity put it first.
- `token_market` keeps only the requested address, skipping pairs where the
  token is the quote side.
- `pairCreatedAt` is in milliseconds; `age_hours` is measured from now, in UTC.
- A pump.fun bonding-curve pool can arrive without liquidity, which counts as 0
  in the totals while the main pool's `liquidity_usd` stays `None`.

### Safety (RugCheck)

| Field | Derived from |
| --- | --- |
| `mint_authority`, `freeze_authority` | `mintAuthority`, `freezeAuthority`; `None` means renounced |
| `lp_locked_pct` | Sum of `markets[].lp.lpLockedUSD` over `totalMarketLiquidity`. This matched RugCheck's own summary endpoint on five coins |
| `total_market_liquidity` | `totalMarketLiquidity`, or `None` when `markets` is empty: RugCheck reports 0 for a token whose pools it has not indexed |
| `creator_pct` | `creatorBalance` over `token.supply`, both raw on-chain integers |
| `top_holders`, `top10_pct`, `top10_insiders` | The first 10 of the 20 listed `topHolders`, skipping owners that `knownAccounts` labels `AMM` |
| `rugcheck_score` | `score_normalised`; higher is riskier |
| `transfer_fee_pct`, `mutable_metadata`, `launchpad`, `rugged`, `insiders_detected`, `risks` | Copied from the report |

`knownAccounts` labels are keyed by the holder's `owner` wallet, not its token
account. Only `AMM` holders are skipped: in the new pump.fun coins checked, the
bonding curve held 23-77% of the supply, and counting it would flag almost every
pump.fun coin. `LOCKER` holdings stay counted because locked supply unlocks to
someone later, and `CREATOR` holdings are exactly what the check looks for.

## Rule engine

`rules.assess(Evidence(market=..., safety=...))` returns an `Assessment` with
`score`, `verdict`, `findings`, and `unchecked`. A source that failed is passed
as `None`.

Each rule is a `Rule` entry in `RULES`: a name, a severity, a message, and a
check function. A check returns `True` for a red flag, `False` for fine, or
`None` when the data it needs is missing. `None` puts the rule in `unchecked`;
it never counts as a pass. The `on_safety`, `on_market`, and `on_liquidity`
wrappers return `None` when their source is missing.

A coin is established when its main pool is at least 30 days old; an unknown age
counts as young. Rules with an `established_severity` fail young coins and only
warn about established ones. Liquidity comes from RugCheck's total when it has
one, and otherwise from DexScreener only when the main pool reported a figure.

| Rule | Severity | Flags when |
| --- | --- | --- |
| `mint_authority` | fail | Mint authority is set |
| `freeze_authority` | fail | Freeze authority is set |
| `rugged` | fail | RugCheck marks the token rugged |
| `creator_rugged_before` | fail | RugCheck lists the risk `Creator history of rugged tokens` |
| `liquidity_too_low` | fail | Liquidity below $1,000 |
| `lp_unlocked` | fail, warn if established | Less than 90% of liquidity locked or burned |
| `top10_concentrated` | fail, warn if established | Top 10 holders own more than 30%, pools excluded |
| `thin_liquidity` | warn | Liquidity from $1,000 to under $10,000 |
| `young_pair` | warn | Main pool younger than 24 hours |
| `low_volume` | warn | Less than $1,000 traded in 24 hours |
| `few_holders` | warn | Fewer than 100 holders |
| `creator_holds_supply` | warn | Creator holds more than 5% |
| `insiders_in_top10` | warn | RugCheck marks a top-10 holder as an insider |
| `transfer_fee` | warn | Transfer fee above 0% |
| `mutable_metadata` | warn | Metadata can be changed |

The thresholds are constants at the top of `rules.py` and are starting values,
not calibrated ones. The score adds 40 points per fail and 10 per warn, capped
at 100; higher is riskier. The verdict is `Avoid` when any rule fails, `High
risk` at 40 points or more or when any fail-severity rule is unchecked, and
`Watch` otherwise. There is no safe verdict, and missing data can never improve
one: with RugCheck down, a coin with no findings is still `High risk`.

On the saved coins, Bonk and the new pump.fun coin score `Watch` (30 and 20
points), and the two risky coins score `Avoid`.

## Parallel collection

`analyzer.collect` opens one `httpx.AsyncClient` and runs the token-pair request
and the RugCheck report through `asyncio.gather(..., return_exceptions=True)`.
`analyzer.build_report` turns a failed source's exception into an entry in
`errors` and passes the source to the rules as `None`; the command line prints
it as `unavailable: <reason>`, while the other section still prints. With
RugCheck's timeout set to 0.001 seconds, Bonk showed `HIGH RISK (risk score
0/100)` with the unchecked rules listed and a complete Market section. The pick
prompt runs between two `asyncio.run` calls, because `input()` inside async code
would block every request in flight.

On a new coin, parallel collection took 1.2-1.35 seconds against 1.4-3.5
sequentially. Bonk took about 4 seconds either way, since RugCheck's 2.5 MB
download dominates. The gain grows as later phases add sources.

## Tests

Run `pytest` from `backend/` (`pytest -v` lists each test). The suite reads the
saved responses and makes no network calls; 19 tests pass.

| File | Covers |
| --- | --- |
| `tests/conftest.py` | `raw(coin, source)` loads a saved response; `evidence(coin, age_hours)` builds rule input from a saved coin |
| `tests/test_rules.py` | Verdict per saved coin, missing RugCheck never earning `Watch`, established versus young severity, the creator-history risk name, liquidity sources, score cap, and the High-risk boundary |
| `tests/test_collectors.py` | Search ranking by volume and pool exclusion from top holders |
| `tests/test_analyzer.py` | A failed source becoming an `errors` entry, and a report surviving conversion to JSON and back |

There are no route tests yet. The planned `tests/test_memecoin_routes.py` runs
the memecoin router alone in a `TestClient`, replacing `get_current_user` through
`app.dependency_overrides` and the network functions through `monkeypatch`, so
it needs neither a login nor a database.

`age_hours` is measured from the current time, so a saved coin keeps getting
older. Tests pass the age they mean to `evidence()` instead of relying on the
clock; left to the clock, a young coin's fail would turn into a warning 30 days
later without any code change.

When first run, the suite caught two defects: `HIGH_RISK_SCORE` set to 4, which
made one warning enough for `High risk`, and RugCheck's 0 liquidity for a coin
with no indexed pools being treated as $0. Both are fixed.

### Fixtures

`--save` writes `search.json`, `dexscreener.json`, and `rugcheck.json` to
`backend/tests/fixtures/<symbol>-<first 8 address characters>/`. The symbol is
reduced to lowercase letters and digits, so `e/pump` becomes `epump`. Files hold
the unmodified responses as indented UTF-8, and a failed source is not saved.
An existing folder is overwritten without warning.

The suite uses four coins: `bonk-DezXAZ8z` (established), `epump-7haJedyf`
(new pump.fun coin), `fluffs-2Kjgagqi` (concentrated holders, no pools indexed
by RugCheck), and `stonkwheel-FAvikGwx` (creator with a rug history). Saved
coins are snapshots of a moment: `epump` has since moved from its pump.fun
bonding curve to a Meteora pool, and re-saving it breaks
`test_pump_fun_liquidity_comes_from_rugcheck`. Save new coins under new folders
instead of refreshing old ones. A Bonk RugCheck file is about 3.5 MB; every copy
stays in git history.

## Known limitations

- Age is the main pool's age. An old coin whose liquidity moved to a new pool
  can be judged young and get the stricter rules.
- Thresholds and point values are first guesses, not tuned against outcomes.
- Holder shares come from the 20 holders RugCheck lists. Bonk's unlabeled top
  holders, probably exchanges, count as concentration.
- `creator_rugged_before` matches RugCheck's risk name exactly. A rename stops
  the rule silently; `test_creator_with_rug_history_fails` catches it on the
  saved data only.
- Every `analyze` request calls RugCheck, which rate-limits bursts with HTTP 429.
  A 429 currently appears as a RugCheck error in the report.

## Changing behavior

Follow the [change process](change-process.md). Keep printing out of the
collectors and requests out of the summarize functions. Build reports through
`analyzer.py` so the command line and the API stay in step. Add or change a rule
in `RULES`, not in `evaluate`, and run `pytest`; when a verdict changes on
purpose, update the matching test. Save a fresh fixture when a source changes
shape. When Phase 5 adds the AI report, it shares the Gemini key and free-tier
quota with the chat assistant; see [AI chat cost controls](ai-chat.md#cost-controls).
Update this guide and the [changelog](CHANGELOG.md) with each phase.

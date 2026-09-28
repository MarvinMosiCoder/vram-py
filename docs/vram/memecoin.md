# Memecoin analyzer

A risk checker for memecoins on Solana, Ethereum, BNB Smart Chain, Base,
Polygon, Arbitrum, and Robinhood Chain, built inside this backend in phases. The
strategy notes and the phase plan are in [memecoin-strat.md](../../memecoin-strat.md)
(sections 9 and 10). This guide covers what is implemented; the plan covers
what comes next. The output is a risk picture, not investment advice: a coin can
pass every check and still go to zero. For an explanation of the code itself,
with annotated excerpts, read the [code walkthrough](memecoin-walkthrough.md).

## Status

| Phase | State |
| --- | --- |
| 1. Collect coin data | Done: command-line collectors for DexScreener and RugCheck |
| 2. Rule engine | Done: rules as data, risk score, verdict, pytest suite |
| 3. API | Done: shared analyzer core, both routes, a 5-minute report cache, one RugCheck 429 retry, route tests, and a real-login check |
| 4. Next.js pages | Done: TypeScript types, the search page at `/memecoin`, and the report page at `/memecoin/<chain>/<address>`; checked with a mocked API, not yet with a real login |
| 5. Gemini AI report | Postponed on 2026-09-27: with only DexScreener and RugCheck data, an AI would restate the rules. Revisit once Phase 8 collects websites and socials |
| 6. Storage | Done: saved reports and history, wallet lists with blacklist rules, trade journal; checked with tests, a rolled-back Postgres run, and a mocked browser run, not yet with a real login |
| 7. Creator history and bundles | Done with RugCheck data, no Helius key: the creator's other tokens, dead launches, transfer-linked wallets. First-buyer analysis was not built |
| 8. Website and socials | Done: DexScreener's links, domain age from RDAP, first Wayback snapshot (information only). X account checks were not built: X's API is paid |
| Multi-chain | Done 2026-09-27: six EVM chains beside Solana, with safety data from GoPlus; see [Chains](#chains). Watching stays Solana-only |
| 9. Watching wallets | Done: a watch list, buys found through the public Solana RPC, alerts on a Watch page, browser notifications, optional Telegram. Checks run on a button or a command-line loop |

## Source files

| File | Responsibility |
| --- | --- |
| `backend/app/helpers/memecoin/dexscreener.py` | Search and token-pair requests, pool summaries, grouping pools into tokens |
| `backend/app/helpers/memecoin/rugcheck.py` | Report request, LP lock, creator share, top holders, safety summary |
| `backend/app/helpers/memecoin/rules.py` | Rule list, thresholds, evaluation, risk score, verdict |
| `backend/app/helpers/memecoin/analyzer.py` | `collect`, `describe`, `build_report`, `analyze`: the core shared by the command line and the API |
| `backend/app/helpers/memecoin/common.py` | `dig` for nested lookups that return `None` instead of raising |
| `backend/app/helpers/memecoin/check.py` | Command line: search, pick, verdict, printing, `--save` |
| `backend/app/helpers/memecoin/web.py` | Website domain, RDAP and Wayback requests, the `WebData` summary |
| `backend/app/helpers/memecoin/solana_rpc.py` | Public Solana RPC calls, token gains in a transaction |
| `backend/app/helpers/memecoin/chains.py` | The chain registry: ids, names, Solana or EVM, GoPlus ids, explorers, address patterns, `normalize` |
| `backend/app/helpers/memecoin/goplus.py` | GoPlus token security requests and the EVM `SafetyData` summary |
| `backend/alembic/versions/8512ed42c0ac_add_chain_to_memecoin_trades.py` | Adds `chain` to journal trades |
| `frontend-next/components/memecoin/chains.ts` | The chain registry's frontend copy, `isValidAddress`, `isAnyAddress`, `explorerUrl` |
| `backend/app/helpers/memecoin/watch.py` | Watched-wallet scans, alerts, Telegram, and a command line for scheduled checks |
| `backend/app/api/admin/memecoin.py` | `/memecoin/search` and `/memecoin/analyze/{chain}/{address}` |
| `backend/app/schemas/admin/memecoin.py` | `PoolData`, `MarketData`, `Holder`, `Risk`, `SafetyData`, `Finding`, `Assessment`, `CoinReport`, and the storage shapes `ReportSummary`, `SavedReport`, `WalletIn`, `WalletOut`, `TradeIn`, `TradeUpdate`, `TradeOut`, re-exported from `app.schemas`; `SOLANA_ADDRESS` |
| `backend/app/models/admin/memecoin.py` | `MemecoinReport`, `MemecoinWallet`, `MemecoinTrade` tables |
| `backend/app/helpers/memecoin/storage.py` | Saving and listing reports, wallet lists and the blacklist, journal queries; the only memecoin code that uses the database |
| `backend/alembic/versions/b33310bd5184_create_memecoin_tables.py` | Creates the three tables |
| `backend/alembic/versions/6bc95dcb68fa_add_memecoin_watch_columns_and_alerts.py` | Adds the watch columns and `memecoin_alerts` |
| `backend/tests/` | `conftest.py`, `test_rules.py`, `test_collectors.py`, `test_analyzer.py`, `test_web.py`, `test_memecoin_routes.py`, `test_memecoin_records.py`, `test_rugcheck_retry.py`, `test_watch.py`, and the saved responses in `fixtures/` |
| `backend/pytest.ini` | Test paths, import path, and a filter for older schemas' deprecation warnings |
| `frontend-next/types/memecoin.ts` | TypeScript copies of the response schemas; a Python `X \| None` field is `X \| null` |
| `frontend-next/components/memecoin/format.ts` | `usd`, `liquidity`, `age`, `shortAddress`, `price`, `pct`, `count`, `yesNo` display helpers; unknown values show `?` |
| `frontend-next/components/memecoin/MemecoinSearch.tsx` | Search form and result list (client component) |
| `frontend-next/components/memecoin/MemecoinReport.tsx` | Report loading, error and retry, verdict, red flags, market and safety sections (client component) |
| `frontend-next/app/(admin)/memecoin/page.tsx` | `/memecoin` route: page metadata and `MemecoinSearch` |
| `frontend-next/app/(admin)/memecoin/[chain]/[address]/page.tsx` | Report route: validates the URL, then renders `MemecoinReport` |
| `frontend-next/app/(admin)/memecoin/layout.tsx`, `components/memecoin/MemecoinNav.tsx` | Search, History, Wallets, and Journal tabs on every memecoin page |
| `frontend-next/components/memecoin/ReportView.tsx` | Report display shared by live and saved reports; `VerdictBadge`, `Panel`, `journalHref` |
| `frontend-next/components/memecoin/ReportHistory.tsx`, `SavedReportView.tsx` | `/memecoin/history` list and `/memecoin/history/<id>` |
| `frontend-next/components/memecoin/WalletLists.tsx` | `/memecoin/wallets` |
| `frontend-next/components/memecoin/TradeJournal.tsx` | `/memecoin/journal` |
| `frontend-next/components/memecoin/solana.ts` | `isSolanaAddress`, mirroring the backend pattern |
| `frontend-next/components/memecoin/WatchAlerts.tsx`, `app/(admin)/memecoin/watch/page.tsx` | `/memecoin/watch`: watch status, Check now, alerts, browser notifications |

The fetch functions (`search_pairs`, `fetch_token_pairs`, `fetch_report`) are
async and return raw JSON. The pure functions (`summarize_pair`, `group_tokens`,
`token_market`, `summarize_report`, `assess`, `build_report`) turn that JSON into
models and a verdict. `check.py` and the API router are two front-ends over
`analyzer.py`, so both build a report the same way. Only `check.py` prints.

## Run a check

From `backend/` with the virtual environment active:

```powershell
python -m app.helpers.memecoin.check <name or token address>
python -m app.helpers.memecoin.check <name or token address> --chain ethereum
python -m app.helpers.memecoin.check <name or token address> --save
```

- A name lists the matching tokens on the supported chains, with their chain,
  and asks which one to check; Enter picks the first. A search with a single
  match skips the question. `--chain` keeps one chain.
- The output starts with the verdict, risk score, and red flags, followed by the
  Market and Safety sections they were computed from. Safety comes from RugCheck
  for Solana and GoPlus for EVM chains.
- Chains outside [Chains](#chains) are filtered out.
- Both APIs are public, so no key is needed. Nothing is written to the database.
- Use `-m` from `backend/` so the `app.` imports resolve. `--help` lists the options.

## Pages

### Wallet copying and creator search

Creator addresses on live/saved reports show the full selectable address, Copy,
and View created coins. EVM current owners have separate Copy and View owned
contracts controls; an owner is not assumed to be the deployer. Clipboard failures
show a manual-copy message. The Wallet search tab opens `/memecoin/creators`;
report links prefill the chain, address, and relationship and run the search.

Authenticated `GET /memecoin/wallet-tokens/{chain}/{address}` accepts
`relationship=creator|owner` (default creator), `limit` (1–100, default 50), and
`offset` (default 0). Owner lookup is EVM-only. Invalid chain/address, relationship,
or pagination returns 422. Search filters saved report JSON by the recorded
creator or owner and chain, with case-insensitive EVM matching. Solana creator
results also include the saved RugCheck `creator_tokens` lists. Mints are
deduplicated, newest observation first, before pagination; all authenticated
users see the shared report history, matching the existing history permissions.

Results include recorded market cap, creation date where supplied, observation
time, source, and links to analyze the token or read its saved report. Unknown
names/dates/caps remain unknown. These are observed relationships, not a complete
on-chain wallet index or wallet holdings: unseen wallets can return no records.
Current-owner results mean ownership as recorded at observation time. The page
states its coverage and does not interpret an empty result as no launches.
Analyzing a known coin saves its available creator history for later searches.
No new keys, schema changes, or external wallet-history calls are required.

Owners: `WalletAddress.tsx`, `WalletSearch.tsx`, the creators route under
`frontend-next/app/(admin)/memecoin/`, `storage.wallet_tokens`, and the endpoint
in `backend/app/api/admin/memecoin.py`. Tests: `backend/tests/test_wallet_search.py`.

### Quick scalp setup

Live and saved reports include a separate Quick scalp setup panel. Default
minimums are market cap $100,000, selected-pool liquidity $75,000, selected-pool
volume $50,000/1h and $10,000/5m, 100 trades/5m, and a liquidity/market-cap ratio
of 10%. The ratio uses selected-pool liquidity divided by market cap times 100;
missing liquidity or missing/zero market cap makes it unknown, with no FDV
fallback. Liquidity of $100,000 or more
gets an additional depth label. Minimums are editable for the current view and
reset on navigation; these experimental thresholds are not validated returns.
Passing checks and the overall matching status use green badges with explicit
text, independent of the role theme's accent color.
The panel also requires accelerating volume: `m5 > (h1 - m5) / 11`. Pools under
one hour old, missing volumes, or inconsistent overlapping windows have unknown
momentum. It shows FDV and 5m/1h price changes separately; FDV never substitutes
for missing market cap. Trade counts are transactions, not unique traders.

All strategy metrics come from the deepest DexScreener pool selected by the
existing collector, not sums across pools. `Avoid` blocks a match and `High risk`
also prevents the positive label. Missing values remain unknown. This leaves
the existing backend risk rules unchanged.

Authenticated `GET /memecoin/market/{chain}/{address}` validates the chain/address,
fetches DexScreener only, and returns `{market, fetched_at}`; no pairs gives null
market, an upstream HTTP failure gives 502. It neither saves history nor reruns
safety. The live panel calls it immediately and 30 seconds after each request
settles, with a 15-second timeout, and cancels on unmount. Failed refreshes retain
the previous values with an error and suppress a positive match. Market data
older than 60 seconds or safety older than 5 minutes requires a refresh. Use
Refresh full report to rerun the normal analysis (subject to its five-minute
cache). Fetch time is not a guarantee of upstream market-data freshness.

Saved reports show historical metrics without polling. Older saved payloads
default new fields to null; the panel says insufficient data where appropriate.
Market refreshes and custom thresholds are not saved to history or the journal.
Fees, trade-size price impact, and wash-trading detection are not implemented.

Owners: `ScalpPanel.tsx` and the pure filter helper `scalp.ts` under
`frontend-next/components/memecoin/`, with new collector/schema fields and the
market endpoint in the existing backend memecoin files. Filter tests run with
`node --experimental-strip-types --test --test-isolation=none tests/scalp.test.mjs`
from `frontend-next/`; collector and route tests are in `test_scalp_market.py`.

`/memecoin` sits in the `(admin)` route group, so it gets the admin shell and
login redirect. A sidebar link is a menu row added on `/menus` with path
`memecoin` (no leading slash) and type `Route`. `page.tsx` is a server component
that exports `metadata` and renders the client component `MemecoinSearch`.

`MemecoinSearch` sends `GET /memecoin/search?q=` through `lib/http.ts`, which
adds the bearer token. A Chain select next to the box sends `&chain=` to keep
one chain; "All chains" searches every supported one, and each result is
labelled with its chain.

- **Before sending:** the query is trimmed, and fewer than 2 characters shows a
  message without a request.
- **While waiting:** the button reads `Searching…` and is disabled.
- **Results:** `null` means no search yet, so nothing is shown; an empty list
  shows `No token on <chain or a supported chain> matches “<query>”` with the
  query that was searched.
- **Errors:** a 502 shows the backend's `detail`, and a network failure shows
  `Search failed. Try again.`; both clear the previous results.
- **Result rows:** each row links to `/memecoin/<chain>/<address>`, with symbol,
  name, a shortened address, liquidity, 24-hour volume, pool count, and age.
- **Unknown liquidity:** shows `?` when the main pool reported none, because
  DexScreener's total counts a missing figure as $0 (see
  [Market](#market-dexscreener)).
- **Layout:** stacked on phones and a row from 640 px (`sm:`); long names wrap
  without horizontal scrolling.

### Report page

`app/(admin)/memecoin/[chain]/[address]/page.tsx` awaits `params` and checks
them against the API's rules: the chain must be `solana` and the address must
match the same base58 pattern as `SOLANA_ADDRESS` in the router. Anything else
calls `notFound()`, so a URL the API would reject with 422 shows the 404 page
and makes no request. The 404 page arrives with HTTP 200, because the admin
layout has already started streaming; `/users/edit/abc` behaves the same way.
`key={address}` gives each coin a fresh `MemecoinReport`.

`MemecoinReport` requests `GET /memecoin/analyze/{chain}/{address}` in a
`useEffect` when the page opens.

- **While waiting:** "Checking the coin…" with a note that large coins can take
  up to 30 seconds.
- **Errors:** the backend's `detail`, or `Could not load the report. Try again.`
  when the request fails without one, with a Retry button that requests again.
  A response that arrives after leaving the page or retrying is ignored.
- **Header:** symbol and name (from DexScreener, else RugCheck), the full
  address, a verdict badge that always shows the verdict as text beside a
  coloured dot, the score, the local time the report was built, and links to
  DexScreener, RugCheck, and Solscan that open in a new tab.
- **Red flags:** fails first, then warnings. `Watch` adds that it is not a buy
  signal. Unchecked rules are listed by name. When the verdict is `High risk` and
  the score is under 40 (`HIGH_RISK_SCORE`, mirrored in the component), a
  sentence explains that checks which could not run count against the coin (see
  [Rule engine](#rule-engine)).
- **Market and Safety:** the facts `check` prints, with `?` for unknown values.
  A failed source shows `Unavailable: <reason>` from `errors`; DexScreener with
  no pairs shows its own message. RugCheck's risks are listed, and the top
  holders sit in a collapsed `<details>`.
- **Back to search** returns to `/memecoin`. The search results are not kept,
  because they live only in the search page's state.

### Page checks

Verified on 2026-09-27 with `npm run lint`, `npm run build` (Turbopack), and two
Playwright scripts against `next start`, with every API request mocked. The
search script used a result built from the saved Bonk search; the report script
used reports built by `analyzer.build_report` from the saved Bonk, stonkwheel,
fluffs, and epump coins, plus epump with RugCheck returning HTTP 429. Each
checked 16 behaviors at 1280 and 390 px.

- **Search:** the form, the sidebar link, the short-query message, the loading
  state, results and links, unknown values, singular "pool", unknown liquidity,
  long names, no horizontal scroll, the no-match text, 502 and network errors,
  the Enter key, and no page errors.
- **Report:** the loading state, the Bonk header, badge, score, flags, and facts,
  external links, fails before warnings, the High-risk explanation with
  RugCheck unavailable, no explanation for `Avoid`, 404 pages without a request
  for another chain and an EVM address, a server error with Retry, a network
  failure, search to report and back, no horizontal scroll, and no page errors.

The scripts live outside the repo. The pages have not yet been tried against the
real backend with a login.

### Storage pages

A layout in `app/(admin)/memecoin/layout.tsx` puts tabs above every memecoin
page: Search (also active on live reports), History, Wallets, and Journal.

- **History** (`/memecoin/history`) lists saved reports newest first, 50 at a
  time with Load more, each with its verdict badge, score, and time. It filters
  by one mint address, checked in the browser before any request. A row opens
  `/memecoin/history/<id>`, the saved report drawn by the same `ReportView` as a
  live one, with a note that the coin may have changed, a link to check it
  again, and "Log a trade from this report".
- **Wallets** (`/memecoin/wallets`) adds a wallet to the blacklist or the good
  dev list with an optional label and note, and lists both. A second add of the
  same wallet to the same list shows the backend's 409 message. Delete asks for
  a second click.
- **Journal** (`/memecoin/journal`) logs a trade: address, optional symbol,
  entry price, optional USD amount, and the reason. Prices are typed as text,
  because a number input rounds values like 0.0000036. "Log a trade" links fill
  the form from `?address=&symbol=&price=&report=`, and a report id links the
  trade to that saved report. Open trades close with an exit price and reason;
  closed trades show the profit or loss in percent and, with an amount, in USD,
  with a sign so the colour is not the only signal, plus a wins and average line.
- **Report page** panels added in Phases 7-8: Creator history (count, how many
  are worth under $10,000, the ten newest with links to their own reports),
  Website and socials (the site, when its domain was registered, the first
  Wayback snapshot, social links, and a note that X is not checked), and a
  Linked wallets line under Safety.
- **Report page** actions: "Log a trade" and "Add creator to blacklist". The
  latter adds RugCheck's creator with the label `scam dev` and reloads the
  report, which then shows `Avoid` with `creator_blacklisted`; the button hides
  once the creator is on the list.

Verified on 2026-09-27 with `npm run lint`, `npm run build`, and a third
Playwright script against `next start` with a fake backend kept in memory. It
checked 14 behaviors at 1280 and 390 px: the tabs, history paging, the history
address check and filter, a saved report and its links, a missing saved report,
adding, refusing a duplicate, and deleting a wallet, blacklisting a creator from
the report page, journal prefill, the required reason, saving, closing at +100%
and deleting a trade, no horizontal scroll on each page, and no page errors.
The search and report scripts were re-run on the same build and passed.

### Watch page

`/memecoin/watch` (the fifth tab) shows how many wallets are watched and the last
check, a **Check now** button, and the alerts, newest first, with unseen ones
marked `new`. Each alert names the wallet (its label, or "Good dev" / "Watched
wallet"), the amount gained in compact form (96.4M), the token, and links to the
coin's report and the transaction on Solscan. **Mark all seen** clears the
marks. A check's result lists wallets that failed and a Telegram failure.

- **Refresh:** the open page reloads the alerts every 60 seconds; the tab shows
  an unseen count, refreshed on navigation and every 60 seconds.
- **Browser notifications:** "Enable browser notifications" asks permission.
  Granted, a refresh that brings an unseen alert not seen before shows a system
  notification. It works only while a memecoin page is open; the backend does
  not push.
- **Automatic checks:** the page does not start checks by itself. Run
  `python -m app.helpers.memecoin.watch --every 300` from `backend/` for a
  check every 5 minutes, or schedule the one-shot command.
- **Tabs on phones:** at 390 px the five tabs use 13 px text and no gaps, and
  the current tab is scrolled into view, also after fonts load and after the
  badge appears.

The Wallets page gained a third list, Watch list, and watched wallets show when
they were last checked.

Verified on 2026-09-27 with `npm run lint`, `npm run build`, and a fourth
Playwright script with a fake backend: 17 checks at 1280 and 390 px covering the
creator history of a mass launcher, a coin with no website, an own domain with
its age and Wayback date, a launch-week domain flagged, an unknown creator, the
empty Watch page, adding to the watch list, a first check that only sets the
start and a second that finds a buy, the tab badge, Mark all seen, a failing
wallet, a browser notification for a new alert, every tab fitting on screen,
no horizontal scroll, and no page errors. The earlier three scripts were
re-run on the same build and passed.

## API

All routes are in `backend/app/api/admin/memecoin.py`, included in `routers.py`
before the dynamic module router, which would otherwise match `/memecoin/...`.
They require a signed-in user: the auth middleware returns 401 without a bearer
token, and `Depends(get_current_user)` marks them as protected in `/docs`.
`search` calls DexScreener on every request. `analyze` reuses a report for 5
minutes (see [Report cache](#report-cache)), judges it against the blacklist,
and saves it (see [Storage](#storage)).

| Method and path | Parameters | Response |
| --- | --- | --- |
| `GET /memecoin/search` | `q`: 2-100 characters; `chain` (optional): one of the [chains](#chains) | `list[MarketData]` on the supported chains, most traded first |
| `GET /memecoin/analyze/{chain}/{address}` | `chain`: one of the [chains](#chains); `address`: base58 for Solana, `0x` plus 40 hex digits for EVM (any case, stored lower-case) | `CoinReport`, with `chain` |
| `GET /memecoin/reports` | `address` (optional, Solana or EVM), `limit` 1-200 (default 50), `offset` | `list[ReportSummary]`, newest first |
| `GET /memecoin/reports/{id}` | | `SavedReport`: the summary plus the full `report` |
| `GET /memecoin/wallets` | `list` (optional): `blacklist`, `good_dev`, or `watch` | `list[WalletOut]`, newest first |
| `POST /memecoin/wallets` | `WalletIn`: `address` (Solana or EVM), `list`, `label` (optional, 100), `note` (optional, 1000) | 201 `WalletOut` |
| `DELETE /memecoin/wallets/{id}` | | 204 |
| `GET /memecoin/trades` | | `list[TradeOut]`, your trades, newest entry first |
| `POST /memecoin/trades` | `TradeIn`: `chain` (default `solana`), `address` (Solana or EVM), `symbol`, `entry_price` > 0, `amount_usd` > 0 (optional), `entry_reason` (1-2000), `entered_at` (optional, defaults to now), `report_id` (optional) | 201 `TradeOut` |
| `PATCH /memecoin/trades/{id}` | `TradeUpdate`: only the fields sent change; closing sends `exit_price` and `exit_reason` | `TradeOut` |
| `DELETE /memecoin/trades/{id}` | | 204 |
| `GET /memecoin/watch` | | `WatchStatus`: watched wallet count, whether Telegram is set up, last check |
| `POST /memecoin/watch/check` | | `WatchResult`: wallets checked, new alerts, and `errors` by wallet or `telegram` |
| `GET /memecoin/alerts` | `limit` 1-200 (default 50) | `AlertList`: the newest alerts and the unseen count |
| `POST /memecoin/alerts/seen` | | 204; every alert marked seen |

| Status | Cause |
| --- | --- |
| 401 | No or invalid bearer token |
| 404 | No report, wallet, or trade with that id; another user's trade counts as missing |
| 409 | The wallet is already on that list |
| 422 | Invalid parameters or body: `q` too short, a chain other than `solana`, a non-base58 address (for example EVM `0x...`), a price of 0, an empty reason, a `report_id` with no saved report, clearing `entry_price` or `entry_reason`, or a trade left with an exit price but no exit reason or the reverse. Rejected before any external request |
| 502 | `search` only: DexScreener failed; `detail` gives the reason |

`analyze` does not fail when a source does. `CoinReport.errors` maps a failed
source to its reason, for example `{"rugcheck": "ConnectTimeout"}`, its section
is `None`, and the rules report its checks as unchecked. `market` can also be
`None` with no error when DexScreener has no pairs for the mint. `checked_at` is
the UTC time the sources were fetched.

The routes were checked against the full application with the login and the
external APIs replaced by saved data: search and analyze returned 200, a wrong
chain and an EVM address returned 422, and a request without a token returned
401. On 2026-09-27 the user tried both routes on the running server from
`/docs` after Authorize with an admin login. To repeat that, start the backend
on port 8080, open `http://localhost:8080/docs`, and use Authorize with an admin
email and password.

## Storage

### Clear report history

Each history row also has an administrator-only Remove button with an inline
Confirm remove / Cancel prompt. `DELETE /memecoin/reports/{report_id}` removes
only that snapshot, detaches only its journal links in the same transaction,
and returns 204 (404 if already missing, 422 for a non-positive/invalid ID).
It uses the same role-ID-1 restriction as Clear all history and clears the local
analysis cache after success. Other snapshots of the same token are kept. The
page retains its token filter and reloads the first page after the request,
including after errors/timeouts; Cancel makes no request.

The History page exposes Clear all history to administrator role ID 1, following
the existing admin-only API role convention. Confirmation explicitly covers all
users, chains, pages, and token filters. Cancel does not send a request.
`DELETE /memecoin/reports` requires that role and JSON
`{"confirm":"clear_all_reports"}`; missing/wrong confirmation returns 422,
non-admin users receive 403, and unauthenticated requests receive 401.

The transaction detaches every journal `report_id`, deletes saved reports, and
commits once; failure rolls both operations back. It returns `{deleted: count}`
and clears this worker's analysis cache after a successful commit. Trades,
wallet lists, and watch alerts are kept. Wallet-search evidence stored only in
deleted reports is lost. This is permanent, and new analyses (including requests
already in flight) can save reports again; it does not disable history collection.
Other server workers retain their own report caches.

The UI blocks repeat deletes and filter changes during confirmation/deletion,
ignores outdated list responses, and reloads history after success or failure
because a timed-out write may have committed. History is not cleared just by
adding this feature; only the explicit confirmation in the app sends the delete.

Phase 6 added three tables, created by
`alembic/versions/b33310bd5184_create_memecoin_tables.py`. The analyzer and the
rules stay free of database code; `storage.py` holds every query, and the router
passes the rules what they need.

| Table | Holds | Notes |
| --- | --- | --- |
| `memecoin_reports` | address, chain, symbol, name, verdict, score, the full `CoinReport` as JSON, `checked_at`, the requesting user | Shared by all users |
| `memecoin_wallets` | address, `list` (`blacklist` or `good_dev`), label, note, the adding user | Unique per list and address; shared by all users |
| `memecoin_trades` | entry price and reason, optional USD amount, exit price and reason, times, optional `report_id` | Private: every query filters by the signed-in user |
| `memecoin_alerts` | wallet id, address, list, and label, token mint, amount, transaction signature, block time, `seen` | Phase 9. Shared. Unique per transaction, wallet, and token. Deleting the wallet keeps its alerts (`wallet_id` becomes null) |

Phase 9 also added `last_signature` and `last_checked_at` to `memecoin_wallets`:
where the next scan of a watched wallet starts, and when it last ran.

The plan named separate `blacklist_wallets` and `good_devs` tables; one table
with a `list` column holds both, with one set of routes.

- **Saving:** `analyze` saves each report it returns unless a row with the same
  address and `checked_at` exists. A cached report keeps the `checked_at` of the
  request that fetched it, so repeat requests within 5 minutes store it once.
  Reports with a failed source are saved too; they are an honest record.
- **Blocking calls:** `analyze` is async, so it runs the blacklist read and the
  save through `run_in_threadpool` instead of blocking the event loop. The other
  storage routes are plain `def`, which FastAPI already runs in a thread.
- **Times:** stored as naive UTC. `UtcDatetime` in the schemas marks them as UTC
  on the way out (`...Z` or `+00:00`), so a browser does not read them as local
  time. Incoming times with a zone are converted to UTC.
- **Blacklist:** `analyze` reads the blacklisted addresses and passes them to
  the rules as `Evidence.blacklist`. Adding or deleting a blacklist wallet
  clears the whole report cache, because cached reports were judged against the
  old list. Good dev wallets change nothing yet; Phases 7 and 9 are meant to use
  them.
- **Journal:** `pnl_pct` is computed on output as `(exit / entry - 1) * 100`.
  Setting an exit price without an `exited_at` stamps the current time.
- **Command line:** `check.py` does not open the database, so it neither saves
  reports nor applies the blacklist.

Autogenerate also proposed dropping `uq_adm_menus_roles_menu_role`; that is
existing drift unrelated to these tables and was removed from the revision
(see [migrations](migrations.md#troubleshooting)).

Verified on 2026-09-27 against the development Postgres database inside a
transaction that was rolled back, leaving no rows: analyze saved one report for
two requests, the saved report and list returned 200 with UTC times, a
blacklisted creator turned Bonk to `Avoid`, a duplicate wallet returned 409, a
trade at $0.0000036 kept its price and closed at +100%, and both deletes
returned 204.

## Chains

`chains.py` lists the chains; the frontend's `chains.ts` mirrors it, and a test
keeps `schemas.ChainId` in step. A chain's id is DexScreener's `chainId` and the
`{chain}` in the URLs.

| Id | Name | Safety source | GoPlus id | Explorer |
| --- | --- | --- | --- | --- |
| `solana` | Solana | RugCheck | | Solscan |
| `ethereum` | Ethereum | GoPlus | 1 | Etherscan |
| `bsc` | BNB Smart Chain | GoPlus | 56 | BscScan |
| `base` | Base | GoPlus | 8453 | BaseScan |
| `polygon` | Polygon | GoPlus | 137 | PolygonScan |
| `arbitrum` | Arbitrum | GoPlus | 42161 | Arbiscan |
| `robinhood` | Robinhood Chain | GoPlus | 4663 | Blockscout (`robinhoodchain.blockscout.com`) |

The request said "bt", read as BNB Smart Chain, since the strategy notes name
BscScan; Base was added alongside as the other large EVM memecoin chain. Adding
an EVM chain GoPlus supports takes one entry in each registry and its id in
`ChainId`.

- **Addresses:** Solana addresses are base58 and case-sensitive. EVM addresses
  are `0x` and 40 hex digits in any case; `chains.normalize` stores them in
  lower case, so the cache, the history, the blacklist, and GoPlus (which keys
  its answer in lower case) all agree. DexScreener's checksummed spelling still
  matches, because `token_market` compares normalized addresses.
- **Collection:** `analyzer.collect(address, chain)` asks DexScreener and, for
  Solana, RugCheck or, for EVM, GoPlus, at the same time; the website lookups
  follow as before. `Sources` holds `rugcheck` or `goplus`, the other `None`.
  The cache key is `(chain, address)`, so one address on two chains is two
  reports. A GoPlus failure lands in `errors` under `goplus`.
- **Rules:** each `Rule` has `families`. A rule is skipped, neither flagged nor
  unchecked, on a chain it does not apply to; see the Chains column in
  [Rule engine](#rule-engine). Without that, every EVM coin would be `High
  risk`, since RugCheck-only checks such as mint authority can never run there.
- **Watching** stays Solana-only: EVM wallets can sit on the lists, where the
  blacklist rules use them, but a watch check skips them with a note in its
  result, and the watch status counts only Solana wallets.
- **Journal trades** carry their chain (revision `8512ed42c0ac`; existing trades
  became `solana`).

### EVM safety (GoPlus)

`GET https://api.gopluslabs.io/api/v1/token_security/{goplus id}?contract_addresses=<address>`
is free and needs no key. It answers HTTP 200 even when it refuses: `code` is 1
on success and 4029 when rate-limited, which `fetch_token_security` retries once
after 5 seconds. Flags are `"1"`/`"0"` strings; a missing or empty flag means
GoPlus could not tell and stays `None`, which is how an unverified contract
leaves most checks unchecked.

| `SafetyData` field | Derived from |
| --- | --- |
| `honeypot` | `is_honeypot`, or `cannot_sell_all` = 1 |
| `buy_tax_pct`, `sell_tax_pct`, `transfer_fee_pct` | `buy_tax`, `sell_tax`, and the largest of those and `transfer_tax`, fractions times 100 |
| `open_source`, `proxy`, `hidden_owner`, `can_reclaim_ownership`, `creator_made_honeypots` | `is_open_source`, `is_proxy`, `hidden_owner`, `can_take_back_ownership`, `honeypot_with_same_creator` |
| `owner`, `owner_renounced` | `owner_address`. Missing is unknown; empty, the zero address, or `0x…dead` is renounced |
| `owner_can_mint`, `owner_can_change_balances`, `transfers_pausable`, `can_blacklist` | `is_mintable`, `owner_change_balance`, `transfer_pausable`, `is_blacklisted`, counted only while the ownership is held or can be taken back |
| `top_holders`, `top10_pct` | `holders`, leaving out burn addresses and the DEX pair addresses in `dex`; `None` without a holder list |
| `lp_locked_pct` | The share of `lp_holders` that are locked or burn addresses; `None` without LP holders |
| `total_holders`, `creator`, `creator_pct` | `holder_count`, `creator_address` (lower case), `creator_percent` |

On the saved tokens: PEPE (Ethereum) is renounced with no tax and scores
`Watch` like Bonk; a BSC token whose pause function GoPlus reports is not
flagged, because its ownership is renounced; an unverified Ethereum contract is
`Avoid` with its owner powers unchecked; and ROBINHOOD (Robinhood Chain) is
`Avoid` for an unlocked LP and 42% in its top 10 holders.

## Data sources

| Source | Endpoint | Notes |
| --- | --- | --- |
| DexScreener search | `GET https://api.dexscreener.com/latest/dex/search?q=<query>` | Returns pools, not tokens; at most 30 |
| DexScreener token pairs | `GET https://api.dexscreener.com/token-pairs/v1/{chain}/{address}` | Also capped at 30; `/tokens/v1` returns a single pair |
| RugCheck report | `GET https://api.rugcheck.xyz/v1/tokens/{mint}/report` | About 10 KB for a new coin and 2.5 MB for Bonk, which lists every pool. An invalid mint returns HTTP 400 with `{"error": ...}` |
| RDAP | `GET https://rdap.org/domain/{domain}` | Domain registration date; follows a redirect to the registry. An unknown domain returns HTTP 404. Answered in 1.6-3 seconds for `.com`, `.fun`, `.app`, and `.wiki` |
| Wayback availability | `GET https://archive.org/wayback/available?url={domain}&timestamp=19960101` | The snapshot closest to 1996, which is the earliest. Rate-limits hard: HTTP 429 after a few test requests. The CDX API timed out at 15 seconds and is not used |
| Solana RPC | `POST https://api.mainnet-beta.solana.com` | `getSignaturesForAddress`, `getTransaction` with `maxSupportedTransactionVersion: 1` (version-1 transactions are refused without it). About 40 calls of one method per 10 seconds, then HTTP 429 |
| GoPlus token security | `GET https://api.gopluslabs.io/api/v1/token_security/{goplus id}?contract_addresses=<address>` | EVM safety; see [EVM safety](#evm-safety-goplus). Rate limit answered as code 4029 inside HTTP 200 |
| Telegram (optional) | `POST https://api.telegram.org/bot{token}/sendMessage` | Only when `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set in `backend/.env` |

Timeouts are `TIMEOUT_SECONDS` in each module: 10 seconds for DexScreener and 30
for RugCheck. Every DexScreener endpoint stops at 30 pairs, so pool counts and
totals are a floor for large coins. RugCheck's `totalMarketLiquidity` covers
every pool it has indexed (1,285 for Bonk). New coins usually have one to three
pools. RugCheck answered HTTP 429 when 25 reports were requested at once.

`rugcheck.fetch_report` retries a 429 once. It waits for the `Retry-After`
header's number of seconds, capped at `MAX_RETRY_WAIT_SECONDS` (10), or for
`RETRY_WAIT_SECONDS` (2) when the header is missing or is a date. A second 429
is raised like any other HTTP error and becomes the `rugcheck` entry in
`errors`. The wait uses `asyncio.sleep`, so other requests keep running. Whether
RugCheck sends `Retry-After` has not been observed; the retry was tested only
against a fake server. The command line gets the retry too.

`web.py` uses an 8-second timeout, and `solana_rpc.call` 20 seconds. The RPC
call retries a 429 once with the same wait rule as RugCheck; a transaction scan
also pauses 0.35 seconds between transactions, because 0.2 seconds drew HTTP
429 in practice.

## Report cache

`analyzer.analyze` keeps complete reports in the module dictionary `_cache`,
keyed by address, for `CACHE_SECONDS` (5 minutes), timed with `time.monotonic()`
so a change to the system clock cannot extend or cut it short. A cached report
is returned unchanged, so its `checked_at` is when the sources were fetched. A
report with any `errors` entry is not cached, so the next request tries the
failed source again instead of repeating the failure for 5 minutes.

The cache lives in the server process: a restart empties it, and each uvicorn
worker keeps its own. Expired entries are replaced on the next request for the
same coin but never removed otherwise, which is fine at a few coins a day and
ends when Phase 6 stores reports in Postgres. Two requests for the same
uncached coin at the same moment both fetch. `check.py` calls `collect` and
`build_report` directly, so the command line always fetches.

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
- `websites` and `socials` come from each pair's `info` and are merged across a
  token's pools without repeats, since not every pool lists them.
- A pump.fun bonding-curve pool can arrive without liquidity, which counts as 0
  in the totals while the main pool's `liquidity_usd` stays `None`.

### Safety (RugCheck)

| Field | Derived from |
| --- | --- |
| `mint_authority`, `freeze_authority` | `mintAuthority`, `freezeAuthority`; `None` means renounced |
| `lp_locked_pct` | Sum of `markets[].lp.lpLockedUSD` over `totalMarketLiquidity`. This matched RugCheck's own summary endpoint on five coins |
| `total_market_liquidity` | `totalMarketLiquidity`, or `None` when `markets` is empty: RugCheck reports 0 for a token whose pools it has not indexed |
| `creator_pct` | `creatorBalance` over `token.supply`, both raw on-chain integers |
| `top_holders`, `top10_pct`, `top10_insiders` | The first 10 of the 20 listed `topHolders`, skipping owners that `knownAccounts` labels `AMM`. `None` when `topHolders` is missing or empty; 0 when every listed holder is a pool |
| `rugcheck_score` | `score_normalised`; higher is riskier |
| `transfer_fee_pct`, `mutable_metadata`, `launchpad`, `rugged`, `insiders_detected`, `risks` | Copied from the report |
| `creator_tokens` | `creatorTokens` (mint, market cap, creation time), newest first, without the coin itself. `[]` when RugCheck names a creator but sends null; `None` when it names no creator |
| `insider_networks`, `linked_wallets_pct` | `insiderNetworks`: each group's size and `currentHolding` over `token.supply`; the total is the sum. `None` without a supply. RugCheck sends null when it found no groups, read as none |

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
wrappers return `None` when their source is missing. `on_safety_value(field,
test)` also returns `None` when that one RugCheck field is `None`, so a rule on
an optional field such as `lp_locked_pct` never needs its own `is not None`
test. Written inline as `pct is not None and pct < 90`, a missing value would
pass: `fluffs`, whose pools RugCheck had not indexed, had no LP lock figure and
still passed `lp_unlocked` until this wrapper replaced it.

A coin is established when its main pool is at least 30 days old; an unknown age
counts as young. Rules with an `established_severity` fail young coins and only
warn about established ones. Liquidity comes from RugCheck's total when it has
one, and otherwise from DexScreener only when the main pool reported a figure.

Rules marked Solana use RugCheck data and are skipped on EVM chains; rules
marked EVM use GoPlus data and are skipped on Solana. The rest run everywhere.

| Rule | Severity | Flags when |
| --- | --- | --- |
| `mint_authority` | fail | Solana. Mint authority is set |
| `freeze_authority` | fail | Solana. Freeze authority is set |
| `rugged` | fail | Solana. RugCheck marks the token rugged |
| `creator_rugged_before` | fail | Solana. RugCheck lists the risk `Creator history of rugged tokens` |
| `liquidity_too_low` | fail | Liquidity below $1,000 |
| `lp_unlocked` | fail, warn if established | Less than 90% of liquidity locked or burned |
| `top10_concentrated` | fail, warn if established | Top 10 holders own more than 30%, pools excluded |
| `thin_liquidity` | warn | Liquidity from $1,000 to under $10,000 |
| `young_pair` | warn | Main pool younger than 24 hours |
| `low_volume` | warn | Less than $1,000 traded in 24 hours |
| `few_holders` | warn | Fewer than 100 holders |
| `creator_holds_supply` | warn | Creator holds more than 5% |
| `insiders_in_top10` | warn | Solana. RugCheck marks a top-10 holder as an insider |
| `transfer_fee` | warn | Transfer fee above 0% |
| `mutable_metadata` | warn | Solana. Metadata can be changed |
| `creator_blacklisted` | fail | RugCheck's creator is on your blacklist. With an empty blacklist it always passes; with entries and no known creator it is unchecked |
| `holder_blacklisted` | warn | A top-10 holder (pools excluded) is on your blacklist, for example a bundle wallet |
| `creator_dead_tokens` | fail | Solana. The creator has 5 or more other tokens and at least 80% are worth under $10,000. Unknown creator: unchecked |
| `creator_many_launches` | warn | Solana. The creator has 5 or more other tokens. Unknown creator: unchecked |
| `linked_wallets_hold` | warn | Solana. Transfer-linked wallets hold 10% or more of the supply together |
| `no_socials` | warn | DexScreener lists no website and no social account |
| `new_domain` | warn | The website's domain was registered under 30 days ago. No website or a shared host (`vercel.app`, `x.com`, and others in `web.HOSTED_DOMAINS`) passes; an unknown age with a website of its own is unchecked |
| `honeypot` | fail | EVM. GoPlus flags a honeypot, or that holders cannot sell everything |
| `sell_tax_too_high` | fail | EVM. Sell tax above 10% (`MAX_SELL_TAX_PCT`); any tax also trips `transfer_fee` |
| `not_open_source` | fail | EVM. The contract's source code is not verified |
| `owner_can_mint` | fail | EVM. An active owner can mint |
| `owner_changes_balances` | fail | EVM. An active owner can change balances |
| `can_reclaim_ownership` | fail | EVM. Renounced ownership can be taken back |
| `creator_made_honeypots` | fail | EVM. GoPlus says the creator made honeypots before |
| `hidden_owner` | warn | EVM. The contract has a hidden owner |
| `upgradeable_proxy` | warn | EVM. The contract is an upgradeable proxy |
| `transfers_pausable` | warn | EVM. An active owner can pause transfers |
| `can_blacklist` | warn | EVM. An active owner can blacklist wallets |

The thresholds are constants at the top of `rules.py` and are starting values,
not calibrated ones. The score adds 40 points per fail and 10 per warn, capped
at 100; higher is riskier. The verdict is `Avoid` when any rule fails, `High
risk` when any fail-severity rule is unchecked or when the worst-case score
reaches 40, and `Watch` otherwise. The worst-case score (`worst_case_score`)
adds 10 for each unchecked warning, as if it had fired; the reported `score`
counts only what was found, so a report can show 30 points and `High risk`. There
is no safe verdict, and missing data can never turn a worse verdict into
`Watch`: with RugCheck down, a coin with no findings is still `High risk`, and
with DexScreener down, the unchecked `young_pair` and `low_volume` still count
toward High risk. Before `worst_case_score`, a coin with four warnings including
`young_pair` fell from `High risk` to `Watch` when DexScreener failed.

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

Since Phase 8, `collect` returns an `analyzer.Sources` and has a second step:
the website comes from DexScreener, so once its pairs arrive, the RDAP and
Wayback lookups run together for the first website's domain, unless DexScreener
failed, lists no website, or the site is on a shared host. `build_report`
records an RDAP failure in `errors` and a Wayback failure only in
`web.wayback_error`, so a flaky archive.org does not stop the report being
cached. A live Bonk check took 8 seconds.

On a new coin, parallel collection took 1.2-1.35 seconds against 1.4-3.5
sequentially. Bonk took about 4 seconds either way, since RugCheck's 2.5 MB
download dominates. The gain grows as later phases add sources.

## Tests

Run `pytest` from `backend/` (`pytest -v` lists each test). The suite reads the
saved responses and makes no network calls; 168 tests pass. Starlette's
`TestClient` prints two deprecation warnings from the installed library; they
do not come from this code.

| File | Covers |
| --- | --- |
| `tests/conftest.py` | `raw(coin, source)` loads a saved response; `evidence(coin, age_hours)` builds rule input from a saved coin; `db_session`, `user`, `app`, and `client` run the memecoin router alone on an in-memory SQLite database; an autouse fixture empties the report cache |
| `tests/test_rules.py` | Verdict per saved coin, missing RugCheck or a missing LP lock or top-10 figure never earning `Watch`, a missing DexScreener never lowering `High risk`, unchecked warnings counting toward High risk, established versus young severity, the creator-history risk name, liquidity sources, score cap, and the High-risk boundary |
| `tests/test_collectors.py` | Search ranking by volume, pool exclusion from top holders, and a missing holder list read as unknown rather than 0% |
| `tests/test_analyzer.py` | A failed source becoming an `errors` entry, and a report surviving conversion to JSON and back |
| `tests/test_memecoin_routes.py` | Both routes: 200 responses, the Solana-only search filter, 422 before any external call, a DexScreener search failure as 502, a failed RugCheck inside a 200 report, 401 without a login, and the report cache (reused, expired, and a failed report not kept) |
| `tests/test_memecoin_records.py` | Saved report list, order, filter, paging, UTC times, detail and 404; wallet add, list, filter, 409 duplicate, delete, and validation; trade add, close with profit, exit without reason refused, required fields, privacy between users, report links, and validation |
| `tests/test_rugcheck_retry.py` | One 429 retried, a second 429 raised, other errors not retried, and `Retry-After` followed within its cap |
| `tests/test_web.py` | Registrable domains, which domains are looked up, RDAP and Wayback dates from saved responses, and the web summary with failed or skipped lookups |
| `tests/test_evm.py` | The chain registry matching `ChainId`, address checks per chain, normalization, GoPlus parsing of four saved tokens (renounced ownership, pools and burn addresses, burned LP, unknown owner, unverified contract), the 4029 retry, every EVM rule, Solana-only rules never running on EVM, EVM collection through GoPlus, and the routes with Ethereum and Robinhood Chain addresses |
| `tests/test_watch.py` | Token gains in a saved buy and a saved non-buy transaction, USDC left out, first-scan baseline, oldest-first backlogs across checks, the check endpoint, alerts once, Mark all seen, blacklist not watched, failing wallets, RPC 429 retry and error objects, and Telegram delivery and failure |

`test_collectors.py`, `test_rules.py`, and `test_analyzer.py` also cover the
Phase 7-8 fields and rules, and the order of lookups in `collect`. Deliberate
breakages for Phases 7-9 (alerting on a wallet's history, counting USDC as a
buy, letting a Wayback failure block caching, judging shared hosts by age,
storing duplicate alerts, keeping the coin in its own creator history, and
ignoring the launch count) each failed a test.

The route tests run the memecoin router alone in a `TestClient`, so the auth
middleware is not involved and the configured Postgres database is never
reached: `get_db` is overridden with a fresh in-memory SQLite session per test,
holding only the memecoin tables. `get_current_user` is replaced with a fake
user whose `id` a test can change; removing that override gives the 401 case.
`test_memecoin_routes.py` also covers saving on analyze (once while cached,
again when fresh, with a failed source) and the blacklist turning Bonk to
`Avoid` and clearing the cache. `monkeypatch` replaces `dexscreener.search_pairs` and
`analyzer.collect`, not `analyzer.analyze`, so the real `build_report` runs. The
routes look these functions up through their modules on each call, which is why
replacing the module attribute works. The fakes record their calls, so the 422
and 401 tests also prove no external request was made. The saved Bonk search
holds only Solana pairs, so the search fake adds an Ethereum copy (kept, since
Ethereum is supported) and a PulseChain copy (left out). Removing the login
dependency, the address pattern, the chain restriction, or the chain filter
from the router each fails a test. An
autouse fixture gives each test an empty `_cache`; without it, a Bonk report
cached by one test would answer the next. For Phase 6, saving duplicates,
skipping the cache clear on a blacklist add, dropping the user filter on trades,
accepting an exit without a reason, leaving stored times unmarked, and ignoring
the blacklist in the creator rule each failed a test.

`test_rugcheck_retry.py` passes `fetch_report` an `httpx.AsyncClient` built on
`httpx.MockTransport`, a fake server that returns the listed responses in
order and counts requests. `asyncio.sleep` is replaced with a function that
records the wait, so the tests do not pause. Disabling the cache, caching failed
reports, removing the retry, or retrying every error each fails a test.

`age_hours` is measured from the current time, so a saved coin keeps getting
older. Tests pass the age they mean to `evidence()` instead of relying on the
clock; left to the clock, a young coin's fail would turn into a warning 30 days
later without any code change.

When first run, the suite caught two defects: `HIGH_RISK_SCORE` set to 4, which
made one warning enough for `High risk`, and RugCheck's 0 liquidity for a coin
with no indexed pools being treated as $0. Both are fixed.

### Fixtures

`--save` writes `search.json`, `dexscreener.json`, `rugcheck.json`, and, when
they were fetched, `rdap.json` and `wayback.json` to
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

EVM fixtures hold `dexscreener.json` and `goplus.json` (the full GoPlus answer):
`pepe-0x698250` (Ethereum, plus a mixed-chain `search.json`),
`robinhood-0x008df4` (Robinhood Chain), `pausable-0x6331bf` (BSC), and
`unverified-0x8562c3` (Ethereum, source not verified). `goplus-errors/rate-limited.json`
is a real code-4029 answer. `--save` also writes `goplus.json` for EVM coins.

`bonk`, `epump`, and `fluffs` have a saved `rdap.json` (bonkcoin.com, registered
2022-12-18; e-pump.app, registered 2026-09-26, a day before its pool; and
runescape.wiki, 2018, a wiki page FLUFFS points at). `bonk` also has
`wayback.json`: bonkcoin.com was archived in 2018, before its 2022
registration, so the domain had an earlier owner. `fixtures/solana/` holds a
real version-1 transaction in which the STONKWHEEL creator gained 96,449,438
tokens of a new pump.fun coin, and one without a gain.

## Known limitations

- Age is the main pool's age. An old coin whose liquidity moved to a new pool
  can be judged young and get the stricter rules.
- Thresholds and point values are first guesses, not tuned against outcomes.
- Holder shares come from the 20 holders RugCheck lists. Bonk's unlabeled top
  holders, probably exchanges, count as concentration.
- `creator_rugged_before` matches RugCheck's risk name exactly. A rename stops
  the rule silently; `test_creator_with_rug_history_fails` catches it on the
  saved data only.
- RugCheck rate-limits bursts with HTTP 429. After one retry, a 429 appears as
  a RugCheck error in the report. The cache spares repeat requests for the same
  coin, not requests for many different coins.
- Any signed-in user can edit the shared wallet lists, which change everyone's
  verdicts, and read every saved report. Only trades are private.
- The command line ignores the blacklist and saves nothing.
- Saved reports are never pruned; each fresh fetch adds a row.
- Creator history trusts RugCheck's `creatorTokens`, and "dead" means a market
  cap under $10,000 at the time of the check, not a confirmed rug. Checking each
  earlier token's own report would cost one RugCheck request per token.
- The plan's first-buyer check (same buy amounts, same funding wallet) was not
  built; transfer-linked wallets are the nearest signal RugCheck gives.
- `registrable_domain` uses a short rule, not the public suffix list, and a coin
  can point at a site that is not its own (FLUFFS links a wiki page), which the
  domain age cannot tell. The first Wayback snapshot is shown, not scored.
- X accounts are not checked, because X's API is paid.
- Watching needs a check to run: the button, or the command-line loop. Nothing
  runs in the web server's background, and browser notifications work only
  with a memecoin page open. The navbar bell is not used: its
  `/notification/notifications` endpoint is not served by this backend.
- A wallet gaining a token is reported as a buy; an airdrop or a transfer in
  looks the same. Watched wallets and alerts are shared by all users.
- EVM wallets are not watched; only Solana wallets are scanned.
- On EVM, `lp_locked_pct` covers the LP holders GoPlus lists. Uniswap V3 and V4
  positions often have no lock, so new V4 coins such as those on Robinhood
  Chain tend to fail `lp_unlocked`. A V4 pool's tokens sit in the chain's
  PoolManager contract, which GoPlus does not tag, so it can count as a top
  holder.
- EVM creator history is only GoPlus's honeypot flag; RugCheck's list of a
  creator's other launches exists for Solana only.
- The public RPC's limits allow a handful of wallets; a check looks at up to 20
  transactions per wallet and leaves the rest for the next check.

## Changing behavior

Follow the [change process](change-process.md). Keep printing out of the
collectors and requests out of the summarize functions. Build reports through
`analyzer.py` so the command line and the API stay in step. Add or change a rule
in `RULES`, not in `evaluate`, and run `pytest`; when a verdict changes on
purpose, update the matching test. Save a fresh fixture when a source changes
shape. When Phase 5 adds the AI report, it shares the Gemini key and free-tier
quota with the chat assistant; see [AI chat cost controls](ai-chat.md#cost-controls).
Update this guide and the [changelog](CHANGELOG.md) with each phase.

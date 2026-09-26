# Memecoin Strategy

Working notes for the upcoming memecoin analyzer project. Memecoins are extremely
high risk; treat every check below as a way to reduce risk, not remove it.

## 1. Spot bad memecoins fast

- **Recycled X/Twitter account:** check whether the account has been used for a
  previous launch (with a bot if you have one). Without a bot, block known scam
  accounts on X as you find them.
- **Copied website:** run the site through a website checker to see if it is a
  copy of another project.
- **Repeat devs and bundled buys:** check whether the same devs launched earlier
  coins. Be suspicious when many first buys come from the same wallets, when the
  first buyers all buy the same amount, or when the chart spikes briefly and dumps.
- **Remakes:** many memes are projects that have been relaunched many times.

## 2. Verify the site, contract, and team

Replace the example domain and handle with the project you are checking.

| Check | How | Red flag |
| --- | --- | --- |
| Domain age | Look up the domain (e.g. `standardreserve.xyz`) on whois.com or whois.domaintools.com | Registered days or weeks ago with no prior build-up |
| Site history | Enter the URL on web.archive.org | Appeared fully formed with no drafts, or copy-pasted with names swapped |
| Verified contract | Look up the token contract (not the website) on Etherscan | Source not verified, or behavior differs from the whitepaper |
| Honeypot / mint / fees | Run the contract through Honeypot.is or TokenSniffer | Can't sell, unlimited mint, blacklist, or fees changeable to 100% |
| Liquidity lock | Check Unicrypt or Team Finance | Liquidity unlocked, short lock, or small locked amount. Confirm "protocol-owned, never withdrawable" claims on-chain |
| Owner powers | Check ownership on Etherscan | Deployer is sole owner with no multisig, delay, or notice and can change fees, auction sizes, or epoch length. Check whether ownership was renounced or moved to a multisig |
| Holder concentration | DexScreener, DexTools, or the Etherscan/BscScan holder list | A few wallets (especially deployer/team) hold a large share of supply |
| Socials and team | Check the X account (e.g. `@standard_rsv`) age and engagement; verify named team via LinkedIn or past projects; search "<name> scam" / "<name> rug" | New account, bought followers, unverifiable team, existing scam reports |

The contract tools above are for EVM chains. For Solana coins (pump.fun, BullX,
Solscan), the equivalent checks are mint authority, freeze authority, LP burned or
locked, and top-holder share (for example via RugCheck).

## 3. Find good memecoins

### Track X/Twitter accounts

- Trackers: Pootsnipdata, Tweetshift.
- Tweets can cause huge pumps; tracking accounts lets you be one of the first buyers.
- Track worldwide figures (e.g. Elon), Gen Z influencers, crypto influencers (e.g.
  Ansem), good traders, and news accounts.

### Track wallets

- Trackers: Pootsnipdata, Oteh, Coila, Reptile. Track influencer and good-trader wallets.

Steps:

1. Find top traders on BullX, or get an influencer's wallet. Search the wallet on
   X to see if someone has identified it, and check connected wallets on Solscan.
2. Check PNL (profit/loss): positive connections are good. Compare coins on BullX
   or Solscan, match top traders, and find wallets that recur.
3. Use Coila, GMGN, or Birdeye to confirm the wallets are consistently profitable.
4. Be careful with widely known wallets: you compete with many others, including
   copy-trading bots.
5. **Pro tip:** influencers dump harder when people copy-trade them. Look for
   smaller wallets that consistently buy before the known wallet does, and track
   those instead.

### Track dev wallets

1. Follow wallets that launched huge memecoins and have a record of launches that pump.
2. Track dev wallets from coins that pump; blacklist coins from scam devs.
3. Keep a list of good devs, search for them on pump.fun, or trace previous
   launches from a wallet.
4. Investigate why other coins pump. Example: one trader found scam devs who pumped
   and dumped projects using the same bundle wallets, tracked those wallets, bought
   new coins when they did, and took quick profits.

## 4. Join alpha Discords and make friends

- Get wallet alerts, PNL, and trade signals.
- The meta changes constantly; smart traders' discussions keep you current.
- Groups bundle their tools in one place and often voice-chat about the best memes.
- Groups mentioned: HighTable, Ansem's Discord, YogaPetz, Pissier Alpha, Dogewind,
  Heaven or Hell, The Kitchen.

## 5. Put serious time in

Build a system that shows you memes faster. The longer you scan coins on X, the
higher the chance you find a 100x play.

## 6. Understand the meme formula and hype

- Recurring themes come back again and again; use alpha groups and the tools above
  to recognize them.
- Check @memecoinsX on X daily.
- Watch for beta projects and unreleased coins.

## 7. Trading habits

- **Momentum coins:** search the name on pump.fun to see if it launched before. If
  the features match, the original devs are likely relaunching.
- **Track trades** in a spreadsheet or with alerts so you can see what worked.
- **Journal** why you entered and exited every trade.

## 8. Trading setup

- Multiple monitors: X tracker on the left, BullX pump viewer in the middle,
  wallet tracker on the right, with Discord sidebars out of the way.
- Without multiple monitors, use a phone or a second screen.

## 9. Analyzer build plan

Goal: enter a coin name or contract address and get a risk report with evidence.
The output is a risk rating, not an "invest / don't invest" call; a coin can pass
every check and still go to zero.

### Flow

```
Coin name / contract address
      ↓
Resolve token (DexScreener search → chain + contract + pair)
      ↓
Data collectors (run in parallel)
  • On-chain: mint/freeze authority, LP lock/burn, top holders, deployer wallet   (Helius/Solscan, Etherscan, RugCheck, Honeypot.is, GoPlus)
  • Market: price, liquidity, volume, age, buy/sell ratio, first-buyer bundling   (DexScreener, Birdeye)
  • Dev history: deployer's previous launches and how they ended                  (pump.fun / chain explorer)
  • Web: domain age (WHOIS), Wayback first snapshot, copied site                  (whois API, archive.org)
  • Social: X account age, follower quality, "<name> rug/scam" search             (X API or a search API)
      ↓
Rule engine → hard red flags (can't sell, mint enabled, unlocked LP, top 10 hold >30%) = automatic FAIL
      ↓
AI (one Gemini call) → reads all the evidence, weighs soft signals, writes the report
      ↓
Output: risk score 0–100, verdict (Avoid / High risk / Watch), and the reasons with links
```

### Rules plus AI

- **Rule engine:** catches objective scams reliably and for free. A hard FAIL
  skips the AI call entirely.
- **AI:** handles the fuzzy parts of this strategy: whether the coin is a
  remake, whether the site is copied, whether engagement is bought, and whether a
  known dev wallet is involved.

### AI choice

- **Gemini API free tier** (`gemini-3.6-flash`, about 20 requests/day). At 1–3
  coins a day this costs $0.
- **Single call per coin:** Python runs every collector first, then sends all the
  evidence plus this checklist to Gemini in one request. An agent loop would spend
  one request per tool round and exhaust the free quota.
- A Gemini/Claude/ChatGPT **subscription** does not include API usage. If the free
  tier gets too tight, enable pay-per-use billing on the API key instead.
- Keep the AI call behind one function so the provider can be swapped later.
- Free-tier prompts may be used by Google to improve its products; send only
  public coin data.

### Stack

- **Backend:** Python FastAPI.
- **Frontend:** Next.js: a search box and a report card page.
- **AI:** Gemini API (free tier).
- **Database:** Postgres for saved reports, a personal blacklist of scam devs and
  bundle wallets, and a list of good devs.

### Build order

1. Solana only: resolve the token, run the on-chain and market checks, apply the
   rules, show the result. This alone covers most rugs.
2. Add the Gemini AI report and dev-wallet history.
3. Add website and social checks.
4. Add live wallet and X tracking with alerts (the "find good coins" half of these notes).

## 10. Build to-do list

Step by step, Solana first. Each phase ends with something that works and lists
what it teaches in Python or Next.js. Finish a phase before starting the next.

### Phase 0: Setup

Built inside vram-py instead of a separate repo (decided 2026-09-26). It reuses
the FastAPI backend (port 8080), `frontend-next/`, the Gemini setup from AI
chat, and Postgres with Alembic.

- [x] Add `httpx` and `pytest` to `backend/requirements.txt`.
- [x] Gemini API key: already configured for AI chat, and shares its free quota.
- [ ] Get a free Helius key (needed from Phase 7).

### Phase 1: Fetch coin data (plain Python scripts, no web app yet)

Implemented state is documented in [docs/vram/memecoin.md](docs/vram/memecoin.md).

- [x] Search a coin name on DexScreener
      (`https://api.dexscreener.com/latest/dex/search?q=<name>`) and print each
      match's chain, contract, liquidity, volume, and pair age.
- [x] Handle several coins sharing one name and let the user pick. Sorted by
      24h volume instead of liquidity, because liquidity is easy to fake.
- [x] Fetch a RugCheck report for a Solana mint: mint authority, freeze authority,
      LP locked/burned, top holders. The report endpoint needs no key.
- [x] Calculate top-10 holder share, skipping pools (`AMM` holders).
- [x] Define Pydantic models: `PoolData`, `MarketData`, `Holder`, `Risk`,
      `SafetyData`. No separate `TokenInfo`: `MarketData` carries the identity.
- [x] Run the collectors in parallel with `asyncio.gather`, with timeouts, so one
      failing API doesn't crash the whole check.
- [x] Save real API responses as JSON files to use as test data (`--save`).

Done when: `python -m app.helpers.memecoin.check <coin name>`, run from
`backend/`, prints the collected data for a real coin.
Learn: `async`/`await`, `httpx`, JSON, Pydantic, error handling.

### Phase 2: Rule engine

The rules, thresholds, and scoring as built are in
[docs/vram/memecoin.md](docs/vram/memecoin.md#rule-engine).

- [x] Write rules as data: name, check function, severity (`fail` / `warn`), message.
      A missing source makes a rule unchecked, never passed.
- [x] Hard fails: mint authority enabled, freeze authority enabled, LP not
      locked/burned, top 10 holders over 30%, liquidity below a minimum. The LP
      and top-10 rules only warn for coins 30+ days old, which Bonk needed. Added
      `rugged` and `creator_rugged_before` (RugCheck's creator rug history).
- [x] Warnings: pair younger than 24 hours, low volume, few holders. Added thin
      liquidity, creator holdings, insiders, transfer fee, and mutable metadata.
- [x] Turn the results into a 0–100 risk score and a verdict (Avoid / High risk / Watch).
- [x] Write `pytest` tests that feed the saved JSON files through the rules.

Done when: the script prints a score, verdict, and list of red flags, and the tests pass.
Learn: functions as data, dataclasses/Pydantic, unit testing.

### Phase 3: FastAPI backend

Routes live in `backend/app/api/admin/memecoin.py`, included in `routers.py`
before the dynamic module router. The auth middleware requires a login for
them, and CORS already allows `http://localhost:3000`.

- [x] Move report building into `backend/app/helpers/memecoin/analyzer.py`, shared
      by `check.py` and the routes, with a `CoinReport` response model.
- [x] `GET /memecoin/search?q=<name>` returns the matching coins.
- [x] `GET /memecoin/analyze/{chain}/{address}` returns the full report as JSON.
- [x] Use Pydantic response models so `/docs` documents the API.
- [ ] Route tests in `backend/tests/test_memecoin_routes.py` (next: router alone in
      a `TestClient`, login and network replaced).
- [ ] Try both endpoints from `/docs` after Authorize.
- [ ] Cache reports in memory for a few minutes to save API calls, and handle
      RugCheck's HTTP 429.

Done when: both endpoints work from `http://localhost:8080/docs` after Authorize.
Learn: routes, path/query parameters, response models, CORS.

### Phase 4: Next.js frontend

Pages go under `frontend-next/app/(admin)/memecoin/`, inside the admin shell,
and call the API through `lib/http.ts`. Add the sidebar link on `/menus`.

- [ ] Search page at `/memecoin`: a search box that calls `/memecoin/search` and lists the matches.
- [ ] Report page at `/memecoin/[chain]/[address]`: score, verdict badge, red flags,
      and links to DexScreener, RugCheck, and Solscan.
- [ ] Loading and error states.
- [ ] TypeScript types matching the backend's report JSON.
- [ ] Mobile-friendly layout.

Done when: you can search a coin in the browser and open its report.
Learn: App Router, dynamic routes, client components, `fetch`, `useState`/`useEffect`, TypeScript types.

### Phase 5: Gemini AI report

- [ ] Call Gemini from Python (the same SDK as vram's `backend/app/api/admin/chat.py`).
- [ ] Prompt: this file's checklist plus the collected evidence as JSON; ask for
      JSON back (score, verdict, reasons).
- [ ] Skip the AI call when the rule engine already returned a hard FAIL.
- [ ] Handle 429 errors: retry a short throttle, stop on an exhausted daily quota
      (see vram's `backend/app/helpers/gemini_errors.py`).
- [ ] Cache AI replies per coin.
- [ ] Show the AI summary on the report page, labeled as an AI opinion.

Done when: a passing coin gets a written AI report with 1 Gemini request.
Learn: calling an LLM API, prompt design, structured output, rate limits.

### Phase 6: Database and history

- [ ] Postgres with SQLAlchemy (as in vram): `reports`, `blacklist_wallets`
      (scam devs, bundle wallets), `good_devs`.
- [ ] Save every report and add a history page in Next.js.
- [ ] Rule: a deployer on the blacklist is a hard FAIL.
- [ ] Trade journal: entry/exit price and reason per coin (see section 7).

Done when: past reports and journal entries survive a restart.
Learn: SQLAlchemy models, migrations, CRUD endpoints, list/detail pages.

### Phase 7: Dev history and bundle detection

- [ ] Find the deployer wallet and list its previous tokens (Helius).
- [ ] Mark previous tokens that rugged or died.
- [ ] Check first buyers: same buy amounts or the same funding wallet means a bundle warning.

Learn: working with on-chain transaction data, pagination, heuristics.

### Phase 8: Website and social checks

- [ ] Domain age via a WHOIS API.
- [ ] First Wayback Machine snapshot date.
- [ ] X account checks last, because X's API is the expensive part.

### Phase 9: Tracking and alerts (finding good coins)

- [ ] Watchlist of good-trader, influencer, and dev wallets.
- [ ] Get notified when a watched wallet buys (Helius webhooks or polling).
- [ ] Send alerts to Telegram or the browser.

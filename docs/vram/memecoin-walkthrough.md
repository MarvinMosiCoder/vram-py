# Memecoin analyzer code walkthrough

This guide walks through how the analyzer's code works and why it is shaped
this way. It is written for a developer about to work on it, and covers Phases
1-4 and 6-9: the collectors, the rule engine, the command line, the API, the
tests, the Next.js pages, storage, creator history, website checks, wallet
watching, and the EVM chains added beside Solana. Phase 5, the AI report, is
postponed.
The [memecoin analyzer](memecoin.md) guide stays the reference for behavior: the
full rule list, field derivations, status codes, fixtures, and limitations. The
phase plan is in [memecoin-strat.md](../../memecoin-strat.md) section 10.

Code excerpts are copied from the source. Docstrings and most comments are
left out, and other cuts are marked with `...`.

## The big picture

A request takes a chain and a token address and returns a `CoinReport`: market
data, safety data, and a rule verdict (`Avoid`, `High risk`, or `Watch`). Safety
data comes from RugCheck on Solana and from GoPlus on the EVM chains; see
[Chains](#chains).

```
 GET /memecoin/analyze/solana/<mint>          python -m app.helpers.memecoin.check <name>
              |                                              |
   api/admin/memecoin.py                          check.py: search, pick a token
   validates input, requires login                           |
              |                                              |
   analyzer.analyze()                                        |
   returns a cached report if one is under 5 minutes old     |
              |                                              |
              +------------------+---------------------------+
                                 |
                      analyzer.collect()         step 1: both at the same time
                      |                  |
     dexscreener.fetch_token_pairs   rugcheck.fetch_report (Solana, retries one 429)
                      |              or goplus.fetch_token_security (EVM)
                      |                  |
                      |   step 2, when DexScreener names a website of its own:
                      |   web.fetch_rdap + web.fetch_wayback, at the same time
                      |                  |
                      +--------+---------+    -> analyzer.Sources
                               |
                    analyzer.build_report()
                    token_market()      -> MarketData (with websites, socials)
                    summarize_report()  -> SafetyData (with creator history)
                    summarize_web()     -> WebData (domain age, Wayback)
                    rules.assess()      -> Assessment (score, verdict, findings)
                               |
                          CoinReport  -> JSON from the API, printed by check.py
```

The code is split into layers. Each layer has one job, so it can be tested on
its own:

| Layer | Functions | Network | Why it is separate |
| --- | --- | --- | --- |
| Fetch | `search_pairs`, `fetch_token_pairs`, `fetch_report`, `fetch_rdap`, `fetch_wayback`, `solana_rpc.signatures`, `solana_rpc.transaction` | Yes | The only code that talks to outside services. Returns raw JSON. |
| Shape | `summarize_pair`, `group_tokens`, `token_market`, `summarize_report`, `summarize_web`, `token_gains` | No | Pure functions from raw JSON to models, so tests feed them saved JSON. |
| Judge | `rules.assess` and the `RULES` list | No | Pure functions from models to a verdict. |
| Orchestrate | `analyzer.collect`, `build_report`, `analyze` | Only through Fetch | Runs the layers in order. The command line and the API both go through it. |
| Store | `storage.py` | Database | Saved reports, wallet lists, the journal. Only the routes call it; the rules get the blacklist as a plain set. |
| Front-ends | `check.py`, `api/admin/memecoin.py` | Only through the analyzer | Input and output only: prompts and printing, or HTTP. |

| File | Responsibility |
| --- | --- |
| [schemas/admin/memecoin.py](../../backend/app/schemas/admin/memecoin.py) | Pydantic models for every shape above |
| [helpers/memecoin/common.py](../../backend/app/helpers/memecoin/common.py) | `dig`, for safe nested lookups |
| [helpers/memecoin/dexscreener.py](../../backend/app/helpers/memecoin/dexscreener.py) | Market data: pools, prices, liquidity, volume, age |
| [helpers/memecoin/rugcheck.py](../../backend/app/helpers/memecoin/rugcheck.py) | Safety data: authorities, LP lock, holders, risks |
| [helpers/memecoin/analyzer.py](../../backend/app/helpers/memecoin/analyzer.py) | Parallel collection, report building, the report cache |
| [helpers/memecoin/rules.py](../../backend/app/helpers/memecoin/rules.py) | Rules as data, risk score, verdict |
| [helpers/memecoin/check.py](../../backend/app/helpers/memecoin/check.py) | Command line |
| [helpers/memecoin/web.py](../../backend/app/helpers/memecoin/web.py) | Website domain, RDAP, Wayback |
| [helpers/memecoin/solana_rpc.py](../../backend/app/helpers/memecoin/solana_rpc.py) | Public Solana RPC and token gains |
| [helpers/memecoin/watch.py](../../backend/app/helpers/memecoin/watch.py) | Watched-wallet scans, alerts, Telegram, scheduled checks |
| [helpers/memecoin/storage.py](../../backend/app/helpers/memecoin/storage.py) | Every database query |
| [helpers/memecoin/chains.py](../../backend/app/helpers/memecoin/chains.py) | The chain registry and address rules |
| [helpers/memecoin/goplus.py](../../backend/app/helpers/memecoin/goplus.py) | EVM contract safety from GoPlus |
| [api/admin/memecoin.py](../../backend/app/api/admin/memecoin.py) | The HTTP routes |
| [backend/tests/](../../backend/tests/) | pytest suite and saved API responses |

## 1. Data shapes

Every value that crosses a layer boundary is a Pydantic model. Pydantic checks
types and converts values on the way in. DexScreener sends `priceUsd` as the
string `"0.000003681"`, and `PoolData(price_usd=...)` stores the float
`3.681e-06`.

```python
class PoolData(BaseModel):
    """One trading pool from DexScreener."""
    chain: str
    address: str
    ...
    price_usd: float | None = None
    liquidity_usd: float | None = None
    ...


class MarketData(PoolData):
    """One token: its deepest pool's fields, plus totals across all its pools."""
    pools: int = 1
    total_liquidity_usd: float = 0
    total_volume_24h: float = 0
```

- **Inheritance:** `MarketData` inherits from `PoolData`. A token is described by
  its deepest pool, plus totals added up over all its pools.
- **`None` means unknown, and the rules depend on it.** In `SafetyData`,
  `lp_locked_pct: float | None` is `None` when RugCheck could not measure the
  lock, which is a different fact from 0% locked. The rule engine treats unknown
  as "unchecked" and never as a pass (see [section 5](#5-rule-engine)).
- **The top-level response:** `CoinReport` is what `analyze` returns. Its
  `errors: dict[str, str]` maps a failed source to the reason it failed.
- **Import path:** the models are re-exported from `app.schemas`, so code writes
  `from app import schemas` and then `schemas.CoinReport`, like the rest of the
  backend.
- **API docs:** the routes pass these models as `response_model`, so FastAPI
  documents the exact JSON in `/docs`.

## 2. Collectors

### The `dig` helper

API JSON has optional nested objects. `report["token"]["supply"]` raises an
exception when `token` is missing or is `null`. `dig` returns `None` instead:

```python
def dig(data, *keys):
    """Walk nested keys, returning None as soon as one is missing."""
    for key in keys:
        if not isinstance(data, dict):
            return None
        data = data.get(key)
    return data
```

`dig(pair, "txns", "h24", "buys")` either returns the number or returns `None`.
It never raises.

### Fetch functions

```python
async def search_pairs(client: httpx.AsyncClient, query: str) -> list[dict]:
    response = await client.get(SEARCH_URL, params={"q": query}, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json().get("pairs") or []
```

- **`async def` and `await`:** while the request waits on the network, the event
  loop runs other work, such as the second source's request or other users'
  requests on the server.
- **The client is passed in:** the fetch function does not create its own
  `httpx.AsyncClient`. The caller creates one client and shares it, which reuses
  connections. Tests can pass in a client built on a fake server (see
  [section 8](#8-tests)).
- **Errors are raised, not caught:** `raise_for_status()` turns a 4xx or 5xx
  response into an exception. The caller decides what a failure means.

### DexScreener: from pools to tokens

DexScreener returns pools (pairs), not tokens. A popular coin trades in many
pools, and a search for `bonk` also returns copies of Bonk on other chains.
`summarize_pair` renames the raw camelCase keys into a `PoolData`. Then
`group_tokens` merges pools into tokens:

```python
def group_tokens(pairs: list[dict]) -> list[schemas.MarketData]:
    """One entry per token: its deepest pool, plus totals across all its pools."""
    tokens: dict[tuple[str, str], schemas.MarketData] = {}

    for pair in pairs:
        pool = summarize_pair(pair)
        key = (pool.chain, pool.address)
        liquidity = pool.liquidity_usd or 0
        volume = pool.volume_24h or 0

        token = tokens.get(key)
        if token is None:
            tokens[key] = schemas.MarketData(
                **pool.model_dump(),
                total_liquidity_usd=liquidity,
                total_volume_24h=volume,
            )
            continue

        token.pools += 1
        token.total_liquidity_usd += liquidity
        token.total_volume_24h += volume
        websites, socials = merged_links(token, pool)
        if liquidity > (token.liquidity_usd or 0):
            token = token.model_copy(update=dict(pool))
            tokens[key] = token
        token.websites, token.socials = websites, socials

    # Most traded first. Liquidity is easy to fake: a pool can claim millions
    # and see a few cents of trading a day.
    return sorted(tokens.values(), key=lambda t: t.total_volume_24h, reverse=True)
```

- **The key is a tuple of chain and address.** The same address can be a
  different token on another EVM chain.
- **The first pool seen creates the token.** `**pool.model_dump()` expands the
  pool's fields into keyword arguments.
- **Later pools add to the totals.** When a pool is deeper than the current main
  pool, `model_copy(update=...)` replaces the pool fields and keeps the totals.
  It takes `dict(pool)` rather than `pool.model_dump()`: `model_copy` does not
  validate, so dumped dicts would replace the nested `Social` models.
- **Links are merged across pools** (`merged_links`), because not every pool of a
  token lists its website and socials.
- **Sorted by 24-hour volume, not liquidity.** Liquidity is easy to fake: in a
  `bonk` search, an Ethereum copy claimed $384M of liquidity and $0.01 of daily
  volume.

`token_market` picks one token out of the list:
`next((t for t in group_tokens(pairs) if t.address == address), None)` returns
the first match or `None`. It skips pairs where the requested token is only the
quote side.

### RugCheck: the safety summary

`summarize_report` copies the fields the rules need into a `SafetyData`. Three
of them need more than a copy:

```python
def top_holders(report: dict, count: int = 10) -> list[schemas.Holder]:
    """The biggest holders that are not pools, largest first."""
    known = report.get("knownAccounts") or {}
    holders = []

    for holder in report.get("topHolders") or []:
        label = dig(known, holder.get("owner"), "type")
        if label in POOL_HOLDER_TYPES:
            continue
        ...
```

- **Pools are not holders.** A pump.fun bonding curve can hold 23-77% of a new
  coin's supply. Counting it would flag almost every pump.fun coin as
  concentrated, so holders labeled `AMM` are skipped.
- **Unknown or zero?** When `topHolders` is missing, the top-10 share is `None`,
  meaning unknown. When every listed holder is a pool, it is `0`:
  ```python
  listed = bool(report.get("topHolders"))
  ...
  top10_pct=sum(h.pct for h in holders) if listed else None,
  ```
- **RugCheck reports 0 liquidity for a coin whose pools it has not indexed.**
  `total_market_liquidity` is set to `None` in that case, so the rules do not
  read it as $0.

### Retrying RugCheck's HTTP 429

RugCheck rate-limits bursts. `fetch_report` retries once:

```python
async def fetch_report(client: httpx.AsyncClient, mint: str) -> dict:
    url = REPORT_URL.format(mint=mint)
    response = await client.get(url, timeout=TIMEOUT_SECONDS)
    if response.status_code == 429:
        await asyncio.sleep(retry_wait(response))
        response = await client.get(url, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json()
```

- **Only one retry.** If the second answer is also a 429, `raise_for_status()`
  raises and the report lists it under `errors`. A retry loop could hold a
  request open indefinitely.
- **`retry_wait`:** reads the `Retry-After` header when it is a number and caps
  it at 10 seconds. A missing header, or one given as a date, gives 2 seconds.
- **`asyncio.sleep`, never `time.sleep`:** `time.sleep` would freeze the whole
  event loop, and with it every request the server is handling.

## 3. Analyzer

### Parallel collection

```python
async def collect(address: str, chain: str = "solana") -> Sources:
    network = CHAINS[chain]
    async with httpx.AsyncClient() as client:
        pairs, safety = await asyncio.gather(
            dexscreener.fetch_token_pairs(client, network.id, address),
            safety_request(client, network, address),
            return_exceptions=True,
        )
        sources = Sources(pairs=pairs)
        if network.family == "solana":
            sources.rugcheck = safety
        else:
            sources.goplus = safety

        market = None if isinstance(pairs, Exception) else dexscreener.token_market(pairs, address)
        domain = web.domain_to_check(market)
        if domain:
            sources.rdap, sources.wayback = await asyncio.gather(
                web.fetch_rdap(client, domain),
                web.fetch_wayback(client, domain),
                return_exceptions=True,
            )
        return sources
```

- **`asyncio.gather`** starts both requests and waits for both. The total time
  is roughly the slower request, not the sum of the two.
- **`return_exceptions=True`:** by default, `gather` raises the first exception.
  With this flag, a failed source comes back as an exception object in the
  result list, so one broken API costs its own section, not the whole report.
- **`async with`:** closes the client and its connections when the block ends,
  even after an error.
- **Two steps:** the website comes from DexScreener, so its lookups can only
  start once the pairs are in. Each step is still parallel inside.
- **`Sources`** is a small dataclass holding each raw result or its exception;
  `rdap` and `wayback` stay `None` when there was no domain to look up.

### Building the report

```python
def build_report(
    address: str,
    sources: Sources,
    blacklist: frozenset[str] = frozenset(),
    chain: str = "solana",
) -> schemas.CoinReport:
    network = CHAINS[chain]
    errors = {}
    market = None
    safety = None

    if isinstance(sources.pairs, Exception):
        errors["dexscreener"] = describe(sources.pairs)
    else:
        market = dexscreener.token_market(sources.pairs, address)
    ...
    if isinstance(sources.rdap, Exception):
        errors["rdap"] = describe(sources.rdap)
    web_data = web.summarize_web(market, sources.rdap, sources.wayback)

    return schemas.CoinReport(
        ...
        assessment=rules.assess(evidence),
        errors=errors,
    )
```

`safety_request` picks RugCheck or GoPlus by the chain's family, and
`build_report` summarizes whichever came back. The report carries `chain`.

A Wayback failure is kept in `web.wayback_error`, not in `errors`: no rule uses
the Wayback date, and an entry in `errors` would stop the report being cached,
so a rate-limited archive.org would force every request to refetch everything.

Each input is either raw JSON or an exception. An exception becomes an `errors`
entry and a `None` section, and the rules then report that source's checks as
unchecked. `build_report` makes no requests, so tests call it with saved JSON
and hand-made exceptions such as `httpx.ConnectTimeout("")`.

`describe(error)` turns an exception into one readable line. An HTTP error gives
`HTTP 429: <start of body>`, and a timeout with no message gives the class name,
`ConnectTimeout`.

### The report cache

```python
CACHE_SECONDS = 5 * 60
_cache: dict[tuple[str, str], tuple[float, schemas.CoinReport]] = {}


async def analyze(address: str, blacklist: frozenset[str] = frozenset(), chain: str = "solana") -> schemas.CoinReport:
    cached = _cache.get((chain, address))
    if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
        return cached[1]

    sources = await collect(address, chain)
    report = build_report(address, sources, blacklist, chain)
    if not report.errors:
        _cache[(chain, address)] = (time.monotonic(), report)
    return report
```

- **Each entry is `(time stored, report)`,** keyed by `(chain, address)`: the
  same EVM address can be a different token on another chain.
- **Clock:** `time.monotonic()` only moves forward. A change to the system clock
  cannot make an entry expire early or live forever.
- **Only complete reports are cached.** After a RugCheck timeout, the next
  request tries RugCheck again instead of repeating the failure for 5 minutes.
- **The cache lives in the server process.** A restart empties it, and each
  uvicorn worker keeps its own. Phase 6 replaces it with Postgres storage.
- **The command line always fetches.** `check.py` calls `collect` and
  `build_report` directly and never goes through the cache.

## 4. Front-ends

### Command line

`python -m app.helpers.memecoin.check <name or address> [--save]`, run from
`backend/`. The `-m` flag runs the file as a module, so its `from app import
...` imports resolve.

```python
try:
    search_results = asyncio.run(search(query))
...
# Picking happens between the two asyncio.run calls: input() blocks, and
# blocking inside async code would freeze every request in flight.
token = pick_token(tokens)
...
sources = asyncio.run(analyzer.collect(token.address, token.chain))
...
coin = analyzer.build_report(token.address, sources, chain=token.chain)
```

- **Two `asyncio.run` calls:** each call starts an event loop, runs one
  coroutine, and closes the loop. The prompt runs between the two calls,
  because a blocking `input()` inside async code would stall every request in
  flight.
- **Only this file prints.** The collectors and the rules return data, so the API
  can reuse them without side effects.
- **`--save`** writes the raw responses to `backend/tests/fixtures/<symbol>-<address
  prefix>/`. That is how the saved test data was collected.
- **`sys.stdout.reconfigure(encoding="utf-8")`:** coin names can contain
  characters such as emoji, which the Windows console's default encoding cannot
  print.

### API routes

```python
router = APIRouter(prefix="/memecoin", tags=["memecoin"])


@router.get("/analyze/{chain}/{address}", response_model=schemas.CoinReport)
async def analyze(
    chain: ChainId,
    address: str = Path(pattern=ANY_ADDRESS),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not is_valid_address(CHAINS[chain], address):
        raise HTTPException(status_code=422, detail=f"Not a {CHAINS[chain].name} token address")
    address = normalize(address)
    ...
```

The rest of the body is shown under [Storage](#storage-phase-6).

- **FastAPI checks the input before the function body runs.**
  - `ChainId` (a `Literal` of the supported chains) rejects any other chain
    with 422.
  - `Path(pattern=ANY_ADDRESS)` rejects anything that is neither base58 nor
    `0x` plus 40 hex digits; the body then checks the address fits the chain,
    so an EVM address on Solana is also 422.
  - `normalize` lower-cases an EVM address, so both spellings share one cache
    entry and one history.
  - `Query(min_length=2, max_length=100)` on `search` limits `q`.
  - A bad request never reaches DexScreener or RugCheck.
- **Two login layers.**
  - `RequireAuthMiddleware` in `app/core/middleware.py` returns 401 for any path
    outside `PUBLIC_PATHS` that arrives without a bearer token.
  - `Depends(get_current_user)` decodes the token, loads the user, and shows the
    lock icon in `/docs`.
- **Failures differ by route.**
  - `search` has nothing to show without DexScreener, so it returns 502.
    `raise HTTPException(...) from error` attaches the original exception as
    the cause.
  - `analyze` always returns 200 and lists failed sources in `errors`.
- **Registration order matters.** `routers.py` includes `memecoin.router` before
  `dynamic.router`. The dynamic router declares `/{module_path}/{action}`, which
  would otherwise match `/memecoin/search`. FastAPI takes the first route that
  matches, in the order routes were added.

### Storage (Phase 6)

Three tables in `models/admin/memecoin.py` keep saved reports, wallet lists, and
journal trades. Every query lives in `helpers/memecoin/storage.py`, so the
analyzer and the rules still never import the database.

**The analyze route glues the parts together:**

```python
blacklist = await run_in_threadpool(storage.blacklist, db)
report = await analyzer.analyze(address, blacklist=blacklist, chain=chain)
await run_in_threadpool(storage.save_report, db, report, current_user.id)
return report
```

- **Blocking calls in async code:** SQLAlchemy sessions block. In an `async def`
  route a blocking call would stall every request, so `run_in_threadpool` runs
  it in a worker thread and awaits the result. The other storage routes are
  plain `def`, which FastAPI already runs in a thread.
- **The rules take data, not a database:** the blacklist arrives as a
  `frozenset[str]` in `Evidence.blacklist`, so rule tests pass a set and need
  no database.

**Saving once.** A cached report comes back unchanged, including its
`checked_at`, so the pair address and `checked_at` identifies it:

```python
exists = (
    db.query(models.MemecoinReport.id)
    .filter_by(address=report.address, checked_at=checked_at)
    .first()
)
if exists:
    return None
```

**The blacklist rule** is a plain function rather than a wrapper, because it
needs two inputs:

```python
def creator_blacklisted(e: Evidence) -> bool | None:
    if not e.blacklist:
        return False
    if e.safety is None or e.safety.creator is None:
        return None
    return e.safety.creator in e.blacklist
```

An empty blacklist cannot match anyone, so the rule is checked and passes even
when the creator is unknown. Only with entries does an unknown creator make it
unchecked. Otherwise every coin without a known creator would become
`High risk` the moment the feature shipped.

**Stale cache.** Cached reports were judged against the blacklist at the time,
so adding or deleting a blacklist wallet calls `analyzer.clear_cache()`.

**Private trades.** Every trade query filters by the signed-in user, so another
user's trade id answers 404, the same as a missing one:

```python
return db.query(models.MemecoinTrade).filter_by(id=trade_id, adm_user_id=user_id).first()
```

**Times.** The tables store naive UTC like the rest of the project. A Pydantic
`Annotated` type adds the zone on the way out, so the JSON says UTC and a
browser does not read it as local time:

```python
UtcDatetime = Annotated[datetime, AfterValidator(_assume_utc)]
```

**Computed fields.** `TradeOut.pnl_pct` is a `@computed_field`: it is derived
from the entry and exit prices each time and appears in the JSON, but it is
never stored.

### Watching wallets (Phase 9)

`watch.run_check(db)` scans every wallet on the `good_dev` and `watch` lists and
stores an alert for each token a wallet gained. The Watch page's button calls it
through `POST /memecoin/watch/check`, and `python -m app.helpers.memecoin.watch
--every 300` calls it in a loop, so nothing runs in the web server's background.

**Finding a buy** compares a wallet's token balances before and after one
transaction:

```python
before = {b["mint"]: _amount(b) for b in meta.get("preTokenBalances") or [] if b.get("owner") == owner}
gains = []
for balance in meta.get("postTokenBalances") or []:
    if balance.get("owner") != owner or balance["mint"] in QUOTE_MINTS:
        continue
    gained = _amount(balance) - before.get(balance["mint"], 0)
    if gained > 0:
        gains.append(TokenGain(mint=balance["mint"], amount=gained))
```

A gain in SOL, USDC, or USDT is the other side of a sale, so `QUOTE_MINTS` are
left out. The test data is a real transaction in which a mass launcher gained
96,449,438 tokens of a coin it had just created.

**Scanning a wallet** works forward from where the last check stopped:

```python
newer = await solana_rpc.signatures(client, address, until=last_signature, limit=SIGNATURE_PAGE)
if not newer:
    return last_signature, [], 0
if last_signature is None:
    return newer[0]["signature"], [], 0

pending = list(reversed(newer))  # the RPC lists newest first
batch = pending[:MAX_NEW_TRANSACTIONS]
```

- **First scan:** only records where to start. A wallet's history is not news.
- **Oldest first, 20 at a time:** a backlog carries over to the next check. The
  first version took the newest 20 and skipped older ones; a live run against
  the public RPC showed a real buy 22 transactions back being missed.
- **Rate limits:** the public RPC allows about 40 calls of one method per 10
  seconds. A 0.35-second pause between transactions keeps under it, and
  `solana_rpc.call` retries one 429. A failing wallet keeps its place, so the
  next check retries it.
- **Duplicates:** `record_scan` skips an alert already stored for the same
  transaction, wallet, and token, and a unique constraint backs that up.

**Telegram** is optional: with `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` set,
each new alert is also sent to that chat. A Telegram failure lands in the
result's `errors` and the alert is kept.

### Next.js pages

Two pages in `frontend-next/app/(admin)/memecoin/` call the two routes. The
`(admin)` folder is a route group: it adds the admin shell and login redirect
without appearing in the URL. Each `page.tsx` is a small server component that
renders a client component from `components/memecoin/`, where the state and
requests live.

**Types.** `types/memecoin.ts` copies each Pydantic model. A Python `X | None`
field becomes `X | null`, because FastAPI sends `null` rather than leaving the
key out, and `class MarketData(PoolData)` becomes an intersection:

```tsx
export type MarketData = PoolData & {
  pools: number;
  total_liquidity_usd: number;
  total_volume_24h: number;
};
```

**Search.** `MemecoinSearch` keeps its states apart. `results` is `null` before
the first search and `[]` after a search with no match, so each case shows
something different:

```tsx
const [results, setResults] = useState<MarketData[] | null>(null);
...
try {
  const response = await api.get<MarketData[]>("/memecoin/search", { params: chain ? { q, chain } : { q } });
  setResults(response.data);
  setSearched(q);
} catch (err) {
  setResults(null);
  setError(errorMessage(err, "Search failed. Try again."));
} finally {
  setLoading(false);
}
```

`api` is the Axios client in `lib/http.ts`, which adds the login token. The type
argument in `api.get<MarketData[]>` tells TypeScript the shape of
`response.data`.

**Report route.** The folder names `[chain]` and `[address]` are dynamic
segments. In this Next.js version `params` is a Promise:

```tsx
export default async function Page({ params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await params;
  const network = chainById(chain);
  if (!network || !isValidAddress(network, address)) notFound();
  return <MemecoinReport key={`${chain}/${address}`} chain={chain} address={address} />;
}
```

The page applies the router's own chain list and address patterns, from
`chains.ts`, so a URL the API would reject never becomes a request. The `key`
makes React build a new component for each coin instead of reusing the
previous coin's state.

**Loading the report.** `MemecoinReport` fetches in an effect:

```tsx
useEffect(() => {
  let active = true;
  api
    .get<CoinReport>(`/memecoin/analyze/${chain}/${address}`)
    .then((response) => {
      if (active) setReport(response.data);
    })
    .catch((err) => {
      if (active) setError(errorMessage(err, "Could not load the report. Try again."));
    });
  return () => {
    active = false;
  };
}, [chain, address, attempt]);
```

- **When it runs:** after the first render, and again whenever a value in the
  dependency list changes.
- **The cleanup function** sets `active` to false when the page is left or the
  effect runs again, so a late response cannot overwrite newer state.
- **Retry** clears the error and adds one to `attempt`, which re-runs the effect.

**Explaining the verdict.** Since `worst_case_score`, a report can show 30
points and `High risk`. The page mirrors `HIGH_RISK_SCORE` and says why:

```tsx
const riskFromMissingData = assessment.verdict === "High risk" && assessment.score < HIGH_RISK_SCORE;
```

**Unknown values.** `components/memecoin/format.ts` turns `null` into `?`
instead of `0`. `liquidity(token)` shows `?` when the main pool reported no
liquidity, because DexScreener's total counts that pool as $0, the same reason
`Evidence.liquidity_usd` ignores it.

### Chains

`chains.py` is the one place that knows which chains exist:

```python
Chain("ethereum", "Ethereum", "evm", "1", "https://etherscan.io/token/{address}"),
```

Each entry has DexScreener's id, a display name, the family (`solana` or
`evm`), GoPlus's numeric chain id, and the explorer's token URL. The family
decides three things: the address pattern, the safety source, and which rules
run. `chains.ts` in the frontend repeats the list for the Chain selects,
labels, and links; tests check that the backend's `ChainId` literal and both
registries agree.

**GoPlus quirks the collector handles:**

- A rate limit is **HTTP 200 with `code: 4029`**, not HTTP 429, so the collector
  reads `code` and retries once.
- Flags are `"1"`/`"0"` strings, and a missing flag means "could not tell".
  `flag()` returns `None` for that, and `on_safety_value` turns `None` into
  unchecked, the same rule as on Solana.
- Owner powers only matter while someone holds the ownership:

```python
def owner_power(key: str) -> bool | None:
    power = flag(record, key)
    if power is None or not power:
        return power
    return not (renounced and not reclaimable)
```

A real BSC token has a pause function, but its owner is the zero address, so
nobody can pause it; PEPE is the same. Both pass `transfers_pausable`.

## 5. Rule engine

### A check has three results

Every rule's check returns `True` for a red flag, `False` for fine, or `None`
when the data it needs is missing. `None` puts the rule in `unchecked`, and it
never counts as a pass. A RugCheck outage must not make a coin look safe.

### Evidence and rules

```python
@dataclass
class Evidence:
    """Everything the rules can look at. A source that failed is None."""
    market: schemas.MarketData | None
    safety: schemas.SafetyData | None
    blacklist: frozenset[str] = field(default_factory=frozenset)

    @property
    def established(self) -> bool:
        age = self.market.age_hours if self.market else None
        return age is not None and age >= ESTABLISHED_AFTER_HOURS

    ...


@dataclass(frozen=True)
class Rule:
    name: str
    severity: Severity
    message: str
    check: Callable[[Evidence], bool | None]
    established_severity: Severity | None = None
```

- **`Evidence` carries values derived from both sources.** `established` checks
  whether the main pool is at least 30 days old. `liquidity_usd` prefers
  RugCheck's total over DexScreener's.
- **A `Rule` is plain data,** and its `check` is a function stored in a field.
  `frozen=True` stops code from changing a rule while the program runs.

### Wrappers: functions that build functions

Most checks need one source. Instead of repeating `if e.safety is None: return
None` in every rule, a wrapper takes a small test and returns a full check
function:

```python
def on_safety(test: Callable[[schemas.SafetyData], bool]) -> Callable[[Evidence], bool | None]:
    return lambda e: None if e.safety is None else test(e.safety)


def on_safety_value(field: str, test: Callable[[Any], bool]) -> Callable[[Evidence], bool | None]:
    def check(e: Evidence) -> bool | None:
        value = None if e.safety is None else getattr(e.safety, field)
        return None if value is None else test(value)
    return check
```

The inner function remembers `test` and `field` after the wrapper returns; this
is a closure. `on_safety_value` also treats a missing field as unchecked. It
exists because writing `pct is not None and pct < 90` inline returns `False`, a
pass, when the value is missing. That bug let `lp_unlocked` pass a coin with no
LP lock figure.

Each rule is then one entry in a list:

```python
Rule(
    name="lp_unlocked",
    severity="fail",
    established_severity="warn",
    message=f"Less than {MIN_LP_LOCKED_PCT}% of liquidity is locked or burned",
    check=on_safety_value("lp_locked_pct", lambda pct: pct < MIN_LP_LOCKED_PCT),
),
```

### Creator history and the website (Phases 7-8)

RugCheck lists the creator's other tokens, so a mass launcher shows up without
any wallet data of our own:

```python
def mostly_dead(tokens: list[schemas.CreatorToken]) -> bool:
    dead = sum(1 for token in tokens if token.market_cap is not None and token.market_cap < DEAD_MARKET_CAP_USD)
    return len(tokens) >= MANY_LAUNCHES and dead >= DEAD_SHARE * len(tokens)
```

STONKWHEEL's creator had 50 other tokens, 49 worth under $10,000, launched within
five hours. `creator_tokens` is `None` when RugCheck names no creator, so
`on_safety_value` makes those rules unchecked, and `[]` when a known creator has
no other tokens, so they pass.

The website rule has to tell apart "no site", "a shared host", and "age unknown":

```python
def new_domain(e: Evidence) -> bool | None:
    if e.market is None:
        return None
    if not e.market.websites or (e.web is not None and e.web.hosted):
        return False
    if e.web is None or e.web.domain_age_days is None:
        return None
    return e.web.domain_age_days < NEW_DOMAIN_DAYS
```

A coin with no website is `no_socials`' concern, and a `vercel.app` site's domain
is years old whatever the coin is, so both pass. e-pump.app was registered the
day before its pool opened, which is what the rule is for.

### Rules per chain family

A `Rule` lists the families it applies to, and `evaluate` skips the others:

```python
for rule in RULES:
    if evidence.family not in rule.families:
        continue
    flagged = rule.check(evidence)
```

Skipping is different from unchecked. RugCheck's `mint_authority` can never run
on an EVM coin, and counting it as unchecked would make every EVM coin
`High risk`. EVM coins get their own rules from GoPlus data instead:

```python
Rule(
    name="honeypot",
    severity="fail",
    message="GoPlus flags a honeypot: buyers may not be able to sell",
    check=on_safety_value("honeypot", lambda honeypot: honeypot),
    families=EVM,
),
```

Rules that work from either source (liquidity, LP lock, top-10 holders,
blacklist, website) keep the default, both families.

### From findings to a verdict

```python
def evaluate(evidence: Evidence) -> tuple[list[schemas.Finding], list[str]]:
    findings = []
    unchecked = []

    for rule in RULES:
        flagged = rule.check(evidence)
        if flagged is None:
            unchecked.append(rule.name)
            continue
        if not flagged:
            continue

        severity = rule.severity
        if evidence.established and rule.established_severity:
            severity = rule.established_severity
        findings.append(schemas.Finding(rule=rule.name, severity=severity, message=rule.message))
    ...

FAIL_RULES = {rule.name for rule in RULES if rule.severity == "fail"}
WARN_RULES = {rule.name for rule in RULES if rule.severity == "warn"}


def worst_case_score(findings: list[schemas.Finding], unchecked: list[str]) -> int:
    return risk_score(findings) + SEVERITY_POINTS["warn"] * len(WARN_RULES & set(unchecked))


def verdict_for(findings: list[schemas.Finding], unchecked: list[str]) -> str:
    if any(finding.severity == "fail" for finding in findings):
        return "Avoid"
    if worst_case_score(findings, unchecked) >= HIGH_RISK_SCORE or FAIL_RULES & set(unchecked):
        return "High risk"
    return "Watch"
```

- **Points:** each fail adds 40 and each warning adds 10, capped at 100.
- **`FAIL_RULES & set(unchecked)`** is a set intersection. It is non-empty when a
  hard-fail rule could not run, and a non-empty set is truthy. A coin whose mint
  authority could not be checked cannot get `Watch`.
- **`worst_case_score`** counts every unchecked warning as if it had fired. The
  verdict uses it, so missing data can only make a verdict worse. Without it,
  DexScreener failing left `young_pair` unchecked, and a coin with four warnings
  fell from `High risk` (40) to `Watch` (30). The reported `score` still counts
  only what was found, so a report can show 30 points and `High risk`; the
  `unchecked` list explains why.
- **There is no "safe" verdict.** `Watch` is the best a coin can get.

Worked example, Bonk on 2026-09-27:

- The main pool is 1,372 days old, so Bonk counts as established.
- `lp_unlocked` (15% locked) and `top10_concentrated` (38.5%) are downgraded
  from fail to warn.
- Together with `mutable_metadata`, that makes three warnings, 30 points, and
  `Watch`.
- Given an age of 2 hours, the same data is `Avoid`. `test_the_same_coin_fails_when_young`
  pins that behavior.

## 6. Error handling at a glance

| What fails | Where it is caught | What the user sees |
| --- | --- | --- |
| Bad chain, address, or query | FastAPI validation | 422, before any external request |
| No or invalid login | Middleware or `get_current_user` | 401 |
| DexScreener during `search` | Route: `except httpx.HTTPError` | 502 with the reason |
| One source during `analyze` | `gather(return_exceptions=True)`, then `build_report` | 200. The section is `null`, `errors` gives the reason, and that source's rules are unchecked. Without RugCheck the verdict is `High risk` or worse. Without DexScreener the coin is judged young, which applies the stricter rules, and its unchecked warnings count toward High risk |
| RugCheck 429 | `fetch_report`: one retry | Nothing, unless the retry also gets 429, which then shows in `errors` |
| A missing field in a good response | `None` in the model, then `on_safety_value` | The rule is listed in `unchecked` |

## 7. Design decisions

| Decision | Reason |
| --- | --- |
| Missing data is unchecked, never passed | An outage or a gap in the data must not make a scam look clean |
| Sort search results by volume | Liquidity is easy to fake; trading volume is not |
| Exclude `AMM` holders from the top 10 | Bonding curves and pools are not people who can dump |
| Prefer RugCheck's liquidity total | DexScreener stops at 30 pools and has no figure for bonding curves |
| Relax the LP and top-10 rules after 30 days | Established coins like Bonk would otherwise always be `Avoid` |
| Rules as a list of data | Adding a rule means adding one entry, and the loop does not change |
| One core in `analyzer.py` | The command line and the API cannot drift apart |
| Cache only complete reports | A temporary failure should not stick for 5 minutes |
| Retry a 429 once | Absorbs a burst without letting a request hang |

## 8. Tests

Run `pytest` from `backend/`. The suite makes no network calls, never touches
the configured Postgres database, and passes 123 tests.

### An in-memory database for route tests

`conftest.py` gives each test its own SQLite database in memory, holding only
the memecoin tables, and the `app` fixture swaps it in for `get_db`:

```python
engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
tables = [
    models.MemecoinReport.__table__,
    models.MemecoinWallet.__table__,
    models.MemecoinTrade.__table__,
    models.MemecoinAlert.__table__,
]
Base.metadata.create_all(engine, tables=tables)
```

`StaticPool` keeps one connection, so the thread the `TestClient` runs requests
in sees the same in-memory database as the test. The fake `user` fixture is a
plain object whose `id` a test can change, which is how the privacy test acts as
a second user. Before this, the analyze tests silently reached the real
database once `analyze` started saving; the override makes that impossible.

### Saved data and fixtures

`conftest.py` provides two fixtures. Both return functions, so a test can ask
for any coin:

```python
@pytest.fixture
def evidence():
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
```

Ages are set explicitly. `age_hours` and `domain_age_days` are measured from the
current time, so without the override a saved "new" coin would become
"established" 30 days later, and its test results would change with no code
change. A `sources(coin, rugcheck=...)` fixture likewise builds what `collect`
would return, with any source swapped for an exception.

### Route tests

The route tests run the memecoin router alone. The `app` fixture lives in
`conftest.py`:

```python
@pytest.fixture
def app(db_session, user):
    app = FastAPI()
    app.include_router(memecoin.router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db_session
    return app
```

- **No middleware and no real database.** A bare `FastAPI()` has no auth
  middleware, and `dependency_overrides` swaps the login for a fake user and the
  database for an in-memory one (see
  [below](#an-in-memory-database-for-route-tests)). Removing the
  `get_current_user` override brings back the real login check, which gives the
  401 test.
- **The network is swapped out** with
  `monkeypatch.setattr(dexscreener, "search_pairs", fake)`. This works because
  the route calls `dexscreener.search_pairs(...)` and looks the name up on the
  module at call time. If the route had used
  `from ...dexscreener import search_pairs`, it would hold its own reference and
  the patch would not reach it.
- **`analyzer.collect` is patched, not `analyzer.analyze`,** so the real
  `build_report`, rules, and cache still run.
- **The fakes record their calls.** The 422 and 401 tests assert the records are
  empty, which proves no external request was made.
- **An autouse fixture replaces `_cache` with an empty dictionary** for each
  test. Otherwise a report cached by one test would answer the next.

### Retry tests

`test_rugcheck_retry.py` gives `fetch_report` a client whose "server" is a plain
function:

```python
def fetch(*responses: httpx.Response) -> tuple[dict | Exception, int]:
    queue = list(responses)
    requests = []

    def server(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return queue.pop(0)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(server)) as client:
            try:
                return await rugcheck.fetch_report(client, MINT)
            except httpx.HTTPError as error:
                return error

    return asyncio.run(run()), len(requests)
```

A test lists the responses in order, for example 429 then 200, and checks the
result and the number of requests. `asyncio.sleep` is replaced with a function
that records the wait, so the tests never pause.

### Checking that tests can fail

A test that cannot fail proves nothing. Each change was checked by breaking the
code on purpose and confirming that a test failed. For example, removing the
Solana filter from `search` passed every test at first, because the saved Bonk
search held only Solana pairs. The search fake now adds an Ethereum copy.

## 9. Extending the analyzer

**A new rule**

1. Add a `Rule` to `RULES` in `rules.py`.
2. Pick a wrapper: `on_safety_value` for one RugCheck field, `on_market` for
   DexScreener data, `on_liquidity` for the combined liquidity.
3. Add a test on a saved coin in `test_rules.py`. If a saved coin's verdict
   changes on purpose, update `SCENARIOS`.
4. Add the rule to the table in [memecoin.md](memecoin.md#rule-engine).

**A new data source** (for example, Helius in Phase 7)

1. Write an async fetch function that takes the shared `client` and raises on
   errors.
2. Write a pure summarize function and a Pydantic model for its output.
3. Add the fetch to `collect`'s `gather`, and handle its exception in
   `build_report` under a new `errors` key.
4. Add the model to `Evidence` and `CoinReport`, and write rules against it.
5. Save real responses with `--save` and test the summarize function on them.

**A new route**

1. Add it to `api/admin/memecoin.py` with a `response_model` and
   `Depends(get_current_user)`.
2. Test it in `test_memecoin_routes.py` with the existing fixtures.

## 10. Concepts used

| Python concept | Where |
| --- | --- |
| `async def`, `await`, `asyncio.gather`, `asyncio.run` | Fetch functions, `collect`, `check.py` |
| `async with` context managers | `httpx.AsyncClient` in `collect` and the routes |
| Pydantic models, inheritance, `model_dump`, `model_copy` | Schemas, `group_tokens` |
| Dataclasses, `frozen=True`, `@property` | `Evidence`, `Rule` |
| Functions as values, lambdas, closures | `Rule.check`, the `on_*` wrappers |
| `Literal`, `X \| None` type hints | `Severity`, the chain parameter, optional fields |
| Set operations | `FAIL_RULES & set(unchecked)` |
| Generators with `next(..., default)` | `token_market` |
| Module-level state | `_cache` |
| SQLAlchemy models, sessions, `filter_by`, unique constraints | `models/admin/memecoin.py`, `storage.py` |
| Alembic autogenerate, reviewing drift | `alembic/versions/b33310bd5184_create_memecoin_tables.py` |
| `run_in_threadpool` for blocking calls in async routes | `analyze` |
| Pydantic `Annotated` validators, `@computed_field`, `from_attributes` | `UtcDatetime`, `TradeOut` |
| pytest fixtures, `parametrize`, `monkeypatch`, autouse fixtures | `backend/tests/` |
| FastAPI `Depends`, `dependency_overrides`, `Query`, `Path` | Routes and route tests |
| `httpx.MockTransport` | Retry tests, RPC retry tests |
| A dataclass as a result bundle | `analyzer.Sources`, `watch.Found` |
| Comparing balances before and after | `solana_rpc.token_gains` |
| Cursor-style scanning with `until` | `watch.scan_wallet` |
| `argparse` and a polling loop | `python -m app.helpers.memecoin.watch --every 300` |

| Next.js, React, or TypeScript concept | Where |
| --- | --- |
| Route groups, `page.tsx`, `metadata` | `app/(admin)/memecoin/` |
| Dynamic segments, awaited `params`, `notFound()` | Report route |
| Server page rendering a client component (`"use client"`) | Both pages |
| `useState`, `useEffect` with cleanup, `key` | `MemecoinSearch`, `MemecoinReport` |
| Type unions with `null`, intersections, `Record<Verdict, string>` | `types/memecoin.ts`, `MemecoinReport` |
| Optional chaining `?.` and `??` | Symbol and name fallbacks in the report |
| Tailwind responsive prefixes (`sm:`) and theme tokens (`skin-*`) | Both components |
| Nested layouts | `app/(admin)/memecoin/layout.tsx` and the tabs |
| Awaited `searchParams` in a server page | Journal prefill |
| Lifting shared UI into a component | `ReportView` for live and saved reports |
| `setInterval` with cleanup, `useRef` for values that are not state | Watch page refresh, known alert ids, the tab badge |
| The browser Notification API | Watch page alerts |
| `scrollIntoView` for a sideways-scrolling tab bar | `MemecoinNav` on phones |

## Next

Phases 1-9 and the EVM chains are built. Watching EVM wallets is open (it needs
an RPC per chain), along with three pieces in
[memecoin-strat.md](../../memecoin-strat.md) section 10: the first-buyer bundle
check (needs transaction data, for example from Helius), X account checks (X's
API is paid), and Phase 5, the AI report, which now has websites and creator
history to weigh.

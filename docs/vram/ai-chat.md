# AI chat

This guide owns the chat assistant: the endpoints, prompt construction,
conversation storage, cost controls, and the composer UI. Other guides link
here rather than repeating any of it.

## Source files

| File | Responsibility |
| --- | --- |
| `backend/app/api/admin/chat.py` | Routes, Gemini client, `call_agent`, retry with backoff |
| `backend/app/helpers/chat_helpers.py` | Conversation storage, rate limit, prompts, summarization, response cache |
| `backend/app/helpers/gemini_errors.py` | Reads the `google.rpc` details off a failed call; decides whether a 429 can be retried |
| `backend/app/helpers/fake_api.py` | Stub provider for `CHAT_FAKE=1`; reaches no API. See [stub mode](#stub-mode) |
| `backend/app/core/redis_client.py` | Optional shared Redis client for the limiter and cache |
| `backend/app/models/admin/chat_conversations.py` | The `chat_conversations` table |
| `backend/app/schemas/admin/chat.py` | `ChatRequest`, `ChatMessage`, `ChatConversationsOut` |
| `frontend/src/pages/chat/Chat.jsx` | Transcript, conversation rail, composer; lazy-loaded in `App.jsx` |
| `frontend/src/pages/chat/MarkdownMessage.jsx` | Renders assistant replies as themed markdown |

`chat.router` is registered in `backend/app/api/routers.py` ahead of the dynamic
module router. The same module also serves the `GET /` health check.

## Endpoints

All three require an authenticated user and act only on that user's rows.

| Endpoint | Purpose |
| --- | --- |
| `POST /chat` | Send a message, get a reply |
| `GET /chat/conversations` | The caller's conversations, pinned first |
| `GET /chat/conversations/{id}` | The stored messages of one conversation |
| `POST /conversation-settings` | Rename, pin, archive, or delete one conversation |

### `POST /chat`

| Field | Rules |
| --- | --- |
| `message` | 1-2,000 characters, trimmed; blank rejected by a field validator |
| `conversation_id` | Existing conversation, or `null` to start one |
| `model` | `gemini-3.6-flash` only; `gemini-2.5-flash` now 404s as retired |
| `response_length` | `short`, `medium`, or `long` (default) |

Returns `reply`, `conversation_id`, and `truncated` - the last is true when the
model stopped because it hit the output token cap rather than finishing.

The client no longer supplies conversation history or the summary. That is
deliberate: when the summary came from the request body, anyone could edit it in
the browser and inject text straight into the prompt.

### Listing and loading

`GET /chat/conversations` returns `ChatConversationsOut` rows - `id`, `title`,
`updated_at` only. Summary and messages are excluded so drawing the rail does
not download every conversation in full. Titles are set from the first message
of a conversation, in `save_conversation`.

`GET /chat/conversations/{id}` reuses `load_conversation`, so the ownership
filter and the 404 come from one place.

## Storage

One row per conversation in `chat_conversations`:

| Column | Notes |
| --- | --- |
| `adm_user_id` | Owner; every query filters on it |
| `title` | First message, truncated to 80 characters |
| `summary` | `Text`, not `String(255)` - a 200-word summary exceeds 255 |
| `recent_messages` | `JSON` list of `{role, content}` |
| `archived_at` | Set by the archive action; `list_conversations` filters these out |
| `pinned` | `Boolean`, not null, defaults false; sorts above everything else |

There is deliberately no per-message table. A row holds a summary plus at most
twenty messages no matter how long the conversation runs, so storage stays
bounded.

**Every read and write filters on `adm_user_id` in the same `.filter()` as the
id.** Fetching by id and checking ownership afterwards works until someone adds
an early return above the check. `load_conversation` raises 404 rather than 403
so the response does not confirm that another user's conversation exists.

Assigning to `recent_messages` replaces the list rather than mutating it.
Calling `.append()` on it in place would leave SQLAlchemy's change tracking
unaware and the commit would write nothing.

## Conversation memory

`summarize_if_needed` passes history through below `SUMMARIZE_AFTER_MESSAGES`
(20). At or above it, everything older than the last `KEEP_RECENT_MESSAGES` (6)
is folded into the summary and the recent six are kept verbatim. The
summarization call is pinned to `gemini-3.6-flash` at 1,024 tokens regardless of
the user's selection, so summarizing does not get more expensive when someone
picks a longer response. The 200-word target is an instruction, not an enforced
limit, and summarization adds a second model call to whichever request triggers
it.

`save_conversation` stores exactly what the summarizer returned plus the new
exchange, and **must not apply its own trim**. Capping storage at
`KEEP_RECENT_MESSAGES` looks like the obvious way to bound the row and would
silently disable summarization, because history would never reach 20. The bound
already exists: history grows 2, 4, 6 ... 20, the summarizer collapses it back
to 6, and the row settles between 8 and 20 messages - so the extra summary call
falls on every seventh turn rather than every third, which is what the threshold
buys on a 20-request daily cap.

`build_reply_prompt` combines the summary, the recent messages, and the newest
message. Both prompts tell the model to treat prior conversation as data rather
than instructions - keep those lines when editing prompt text, since they are
the only guard against a stored message steering later turns.

## Cost controls

| Control | Where | Effect |
| --- | --- | --- |
| Input cap | `MAX_MESSAGE_LENGTH` in schema and `Chat.jsx` | 2,000 characters per message |
| Output cap | `RESPONSE_TOKEN_LIMITS` | short 512, medium 1,024, long 2,048 tokens |
| Rate limit | `check_chat_rate_limit` | 10 requests per 60 seconds per user |
| Response cache | `call_with_cache` | Repeat prompts skip the model entirely |
| Stub mode | `CHAT_FAKE=1` | Development answers cost nothing; see [stub mode](#stub-mode) |
| Retry ceiling | `RETRY_ATTEMPTS` | Bounds wasted calls against a throttled quota |
| Quota refusal | `quota_refusal` | A 429 that cannot clear in time is not retried at all |
| Summarization | `summarize_if_needed` | Caps how much history is resent |

The client sends the word `short`/`medium`/`long`; the server maps it to a token
number. Keep it that way - the client must not be able to name an arbitrary
ceiling.

The rate limiter holds a `deque` of monotonic timestamps per user id behind a
lock, expires entries older than the window, and raises 429 with a `Retry-After`
header. See [shared state](#shared-state-redis) for how it behaves across
workers.

## Token usage

`call_agent` is the only function that reaches the API - and the only
provider-specific one in the stack - so it is where usage is recorded. Every successful call logs one line through the stdlib `logging`
module - `logging.basicConfig` is set at the top of `app/main.py`, above the
router import, because a log emitted at import time is otherwise dropped by the
unconfigured root logger:

```
INFO:app.api.admin.chat:agent call=reply model=gemini-3.6-flash in=1840 out=312 total=2152
```

`purpose` labels the line `reply` or `summary`, since a turn can make both calls
and their costs answer different questions. `usage_metadata` and each of its
fields are optional in the SDK, so they are read with `getattr(..., None)` and
never used in arithmetic without a fallback.

**A cache hit produces no log line**, because it never reaches `call_agent`.
Comparing `chat request` lines against `call=reply` lines is how the hit rate
becomes visible. Only successful calls log: a call that failed and was retried
logs once, on the attempt that succeeded, so attempts that were billed but
errored show up as a gap against the Gemini dashboard rather than in the log.

`POST /chat` also returns the turn's usage to the browser:

```json
"usage": {"prompt_tokens": 1840, "output_tokens": 312, "total_tokens": 2152,
          "calls": 1, "cached": false}
```

The route collects every `ModelReply` of the turn in a request-local list, so
`calls: 2` marks a turn that also summarized. That list must stay local to the
request - the route is `def`, so it runs in a threadpool and a module-level list
would mix users together.

`ModelReply` carries the counts, and `ModelReply` is what the cache stores. A
hit would therefore replay the original call's numbers, which is the opposite of
the signal above, so `call_with_cache` returns `replace(entry, cached=True)` on
a hit. `replace` copies, leaving the stored entry correct for the next hit.

## Conversation actions

`POST /conversation-settings` takes `conversation_id`, an `action`, and for
rename a `title`. `load_conversation` applies the ownership filter, so another
user's id raises 404 before any branch runs.

| Action | Effect |
| --- | --- |
| `rename` | Sets `title`; requires a non-blank title within `MAX_TITLE_LENGTH` |
| `pin` | Toggles `pinned`, so one menu entry both pins and unpins |
| `archive` | Stamps `archived_at`; the row stays but leaves the rail |
| `delete` | Removes the row and its stored messages |

`conversation_id` is required. When it defaulted to `None`, `load_conversation`
created a fresh conversation and the endpoint archived or deleted that new row.

In the rail, rename opens a `Modal` with a text input, archive and delete go
through the confirm dialog, and pin applies immediately. Deleting the
conversation currently open calls `startNewChat`. `MAX_TITLE_LENGTH` is 80 in
both the schema and `Chat.jsx`, and `save_conversation` truncates first-message
titles to the same constant.

## Stub mode

`CHAT_FAKE=1` answers chat from a canned stub and reaches no provider. It is a
development setting, not a feature: the free tier allows 20 requests a day, and
one agent task can spend all of them in a single run, so working on anything
above the model call has to be possible without spending quota.

The swap happens at the innermost layer - `_agent_call` binds
`fake_api.fake_agent_call` instead of `call_agent` - so **everything above it
stays in the path**: the conversation is stored, summarization fires on
schedule, the rate limiter counts the request, the response cache stores the
reply under the key a live call would have used, and the retry loop, backoff and
error conversion all run. What is fake is the reply text and the token counts,
which are estimated at four characters per token.

The stub imitates the parts of a real call that the layers above it read,
because a stub returning zeros makes development look healthy while hiding bugs.
The output cap is applied to every stub reply, so `truncated` is reached the
same way it is in production; a latency is slept, because an instant reply hides
the submission lock and the typing indicator; and the token log line is emitted
with `stub=1` appended, so a stub reply can never be mistaken for a billed one.

Markers in the message change what the stub does:

| Marker | Effect |
| --- | --- |
| `/long` | Pads the reply past the token cap, so the truncation notice appears |
| `/fail` | Raises a 503 - retryable, so the backoff runs |
| `/fail 400` | Raises a non-retryable error, converted to a 502 |
| `/fail 429` | A per-minute throttle, retried |
| `/fail 429 daily` | An exhausted daily quota, refused immediately |

Set it in `backend/.env` (`CHAT_FAKE=1`; the key is listed in `.env.example` and
defaults to false). No `GEMINI_API_KEY` is needed while it is on: the Gemini
client is built on first use by `_get_client` rather than at import, because
`genai.Client()` raises without a key and building it at module level made the
whole admin API fail to boot in exactly the situation stub mode exists for. That
holds outside stub mode too - a missing key now fails the first chat request
instead of the server's start, so the rest of the admin runs without one.

`fake_api` logs a warning at import whenever stub mode is on, so a forgotten
stub cannot quietly look like a working assistant - **do not judge a reply's
quality while it is set.**

## Retry and backoff

Three different 429s exist here and only one of them is retried.

| 429 | Raised by | Handling |
| --- | --- | --- |
| This app's own per-user limit | `check_chat_rate_limit` | Returned to the browser to wait out; no model call is made |
| A provider throttle that clears in seconds | Gemini, retried by `call_agent_with_retry` | Backed off and retried |
| A quota that cannot clear in time | Gemini, refused by `quota_refusal` | Returned immediately as 429 with the real `Retry-After` |

The third case is the reason a 429 is not simply retried. A Gemini 429 carries
`google.rpc` detail objects, and `quota_refusal` reads two of them:
`RetryInfo.retryDelay` (a protobuf Duration serialized as a string - `"27s"`)
and `QuotaFailure.violations[].quotaId`, whose `PerDay`/`PerMinute` substring
names the window that was exhausted.

A per-minute throttle clears inside the backoff budget, so it is retried. A
daily quota cannot: retrying spends the full ~4.5 seconds on three calls that
are all certain to fail and then tells the user to "try again shortly", which is
wrong. The decision rests on the `RetryInfo` comparison rather than the
`quotaId` spelling - **any 429 whose own retry hint exceeds `RETRY_MAX_DELAY` is
not retryable here**, whatever the quota is called - while `quotaId` only picks
the wording, since "the daily quota has run out" must not be said about some
other limit. Both details are optional; a 429 carrying neither falls through to
the retry path.

Those readers live in `gemini_errors.py`, not in `chat.py` or
`chat_helpers.py`: reading a Gemini-shaped error body is as provider-specific as
making the call, so it sits beside `call_agent` in responsibility while keeping
the route module to routing and `chat_helpers.py` provider-neutral. The retry
budget stays with the retry loop - `call_agent_with_retry` passes
`RETRY_MAX_DELAY` in as `quota_refusal(error, budget_seconds)` - so tuning the
backoff never means editing the parser.

`RETRY_STATUS_CODES` covers 429 plus transient 5xx. Anything else - a retired
model id is a 404, a malformed request a 400 - fails immediately, because
retrying a deterministic failure only makes the user wait for the same error.
Those are converted to a 502 whose `detail` carries the provider's own wording,
and logged at `ERROR` first. **Do not re-raise the raw `APIError` here.** It
escapes the route unhandled, FastAPI returns a bare 500 with no `detail`, and
the composer can only fall back to "The assistant could not respond" - which
hides the actual cause. Delays double from
`RETRY_BASE_DELAY`, cap at `RETRY_MAX_DELAY`, and are multiplied by a random
0.5-1.5 factor so that simultaneously throttled requests do not retry in
lockstep and collide again. Once attempts are exhausted the route raises 503
with a message the composer can display.

[Stub mode](#stub-mode) raises `errors.APIError` with a body shaped like the
provider's own, so both 429 branches are reachable without spending quota:
`/fail 429` injects a per-minute throttle that is retried, and `/fail 429 daily`
an exhausted daily quota that is refused immediately. Use the elapsed time to
tell them apart - the refusal does not sleep.

The endpoint is `def`, not `async def`, so it runs in a threadpool and `sleep`
blocks a worker thread. Worst case with the current constants is roughly 4.5
seconds. Raising `RETRY_ATTEMPTS` raises that geometrically and can starve the
threadpool - keep it low.

## Response cache

`call_with_cache` wraps `call_agent` through `call_agent_with_retry`; the API
module supplies the `reply_call` and `summary_call` adapters so replies and
summaries share one cache. The layering is **cache, then retry, then Gemini**: a hit never enters
the retry loop, and an entry is only stored once retries have produced a real
answer.

- **Key** - `sha256` over model, max tokens, and the full prompt. Settings are
  part of the key, so a Short answer can never be served for a Long request.
  Hashing keeps a 64-character digest instead of a full prompt per entry.
- **Value** - a `ModelReply(text, truncated)`, so a cached reply keeps its
  truncation flag.
- **Store** - an `OrderedDict` used as an LRU: hits call `move_to_end`, writes
  evict with `popitem(last=False)` past `CACHE_MAX_ENTRIES` (256), and entries
  older than `CACHE_TTL_SECONDS` (3,600) are dropped when read.
- **Empty replies are not stored.** Gemini returns no text when it hits a safety
  filter; caching that would serve nothing for an hour.
- **The model call happens outside `cache_lock`**, so one slow response cannot
  block every other request. The trade-off is that two identical simultaneous
  requests both reach the API.

Because the key covers the whole prompt - summary and history included - hits
come from repeated cold-start questions across conversations, not from repeats
inside one conversation, where the growing history changes the prompt every
turn.

Entries are shared between users, but only byte-identical prompts collide, so no
private history is exposed. See [shared state](#shared-state-redis) for the
Redis-backed alternative.

## Shared state (Redis)

The rate limiter and the response cache are the two pieces of chat state that
outlive a request, and by default both live in process memory. That is correct
for one worker. Run two and each keeps its own counts and its own cache, so ten
requests per minute becomes ten *per worker* and a cached reply only helps the
worker that produced it.

Setting `REDIS_URL` moves both to Redis. Leaving it unset keeps the in-process
behaviour, so local development needs no Redis at all - `redis` is imported
lazily and `app/core/redis_client.py` resolves the client once per process.

| | `REDIS_URL` unset | `REDIS_URL` set |
| --- | --- | --- |
| Rate limit window | Per worker, `deque` under a `Lock` | Shared, one ZSET per user |
| Cache | In-process `OrderedDict` LRU, 256 entries | Redis keys, TTL only |
| On restart | Both cleared | Both survive |

**The limiter runs as a Lua script.** Separate `ZREMRANGEBYSCORE` / `ZCARD` /
`ZADD` calls leave a gap where two workers both read a count under the limit and
both admit a request; a script executes as one Redis operation and cannot. The
score is wall-clock `time()`, not `monotonic()` - monotonic values are only
comparable inside one process, and this key is read by all of them.

**The Redis cache has no entry ceiling.** `CACHE_MAX_ENTRIES` bounds the
in-process `OrderedDict`; in Redis, entries expire after `CACHE_TTL_SECONDS` and
bounding total memory is Redis's `maxmemory` policy rather than this module's
job. `cached` is stored false and set when the entry is read back, because it
describes how *this* response was served, not the stored copy.

**A Redis failure degrades rather than breaks.** An unreachable URL at startup
logs a warning and falls back to in-process state. A failure mid-request does
the same per call: an unreadable cache is treated as a miss, and the limiter
falls back to its per-worker window, which is stricter than no limit at all.

## Frontend

The rail lists the caller's conversations and loads one on click, highlighting
the active row. Failures there use the project's toast convention rather than
the composer's inline alert; see [notifications](notifications.md).

The composer checks the trimmed message before sending and shows a live counter
against the 2,000-character limit. Request errors render in one accessible
alert, FastAPI validation arrays are flattened to text first, and typing clears
the alert. Model and response length share a single `select` whose value joins
both with a pipe. The attachment control stays disabled until uploads exist.
Surface, text, border, error, and accent colors all use theme tokens, so check
both light and black themes after styling changes.

Replies reveal progressively through `showTypingReply`, which sizes each chunk
so any reply length finishes in about 60 ticks. Do not go back to a fixed
character count: at three characters per tick a long reply took roughly half a
minute to appear, and re-rendered the transcript on every one of those ticks.

The route is **lazy-loaded**. `App.jsx` imports it through `React.lazy` behind
a `Suspense` fallback, so react-markdown and its markdown toolchain land in a
separate chunk that only downloads when someone opens `/chat`. That moved the
main bundle from 639 kB to 458 kB. Importing `Chat` statically again silently
undoes it - the warning is a bundle-size number, not a build error.

`MarkdownMessage` maps each markdown element to theme tokens explicitly, because
this project has no typography plugin (Tailwind v4, configured in `index.css`).
User messages are not passed through it - they render as plain pre-wrapped text.
Note that react-markdown dropped the `inline` prop in v9, so the widely copied
`code: ({ inline }) => ...` pattern silently takes the wrong branch; inline
styling is the default here and `pre` resets it for the block it wraps.

When the response carries `truncated`, the bubble shows a note that the length
limit cut the reply short.

## Known gaps

- Loading a conversation restores only the stored window, at most twenty
  messages. Older turns exist only inside the summary.
- Attachments are not implemented.
- Replies are not streamed; the whole answer is generated before anything is
  sent, so nothing appears until it is complete.

## Changing behavior

Follow the [change process](change-process.md), and [migrations](migrations.md)
for the table. When adding a model, update the `Literal` in `ChatRequest` **and**
the option list in `Chat.jsx` - the schema rejects anything the frontend offers
on its own. Keep token numbers on the server, keep the "data, not instructions"
lines in both prompts, and record the change in the [changelog](CHANGELOG.md).

**Everything that changes the reply must be in the cache key.** Today that is
model, token limit, and prompt - and because the prompt carries the summary and
history, a cache hit means the two requests had byte-identical input, which is
why one global cache is safe to share between users. Adding an input that lives
outside the prompt string breaks that. Retrieval scoped to the requesting user,
a tool that reads their records, or a system prompt carrying their name or role
all let two users send the same prompt and deserve different answers; each would
have to be folded into the key, or the key scoped by user id.

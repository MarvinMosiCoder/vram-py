# AI chat

This guide owns the chat assistant: the endpoints, prompt construction,
conversation storage, cost controls, and the composer UI. Other guides link
here rather than repeating any of it.

## Source files

| File | Responsibility |
| --- | --- |
| `backend/app/api/admin/chat.py` | Routes, Gemini client, `real_api_call`, retry with backoff |
| `backend/app/helpers/chat_helpers.py` | Conversation storage, rate limit, prompts, summarization, response cache |
| `backend/app/models/admin/chat_conversations.py` | The `chat_conversations` table |
| `backend/app/schemas/admin/chat.py` | `ChatRequest`, `ChatMessage`, `ChatConversationsOut` |
| `frontend/src/pages/chat/Chat.jsx` | Transcript, conversation rail, composer |
| `frontend/src/pages/chat/MarkdownMessage.jsx` | Renders assistant replies as themed markdown |

`chat.router` is registered in `backend/app/api/routers.py` ahead of the dynamic
module router. The same module also serves the `GET /` health check.

## Endpoints

All three require an authenticated user and act only on that user's rows.

| Endpoint | Purpose |
| --- | --- |
| `POST /chat` | Send a message, get a reply |
| `GET /chat/conversations` | The caller's conversations, most recently used first |
| `GET /chat/conversations/{id}` | The stored messages of one conversation |

### `POST /chat`

| Field | Rules |
| --- | --- |
| `message` | 1-2,000 characters, trimmed; blank rejected by a field validator |
| `conversation_id` | Existing conversation, or `null` to start one |
| `model` | `gemini-3.6-flash` (default) or `gemini-2.5-flash` |
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

There is deliberately no per-message table. A row holds a summary plus at most
a dozen messages no matter how long the conversation runs, so storage stays
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
(12). At or above it, everything older than the last `KEEP_RECENT_MESSAGES` (6)
is folded into the summary and the recent six are kept verbatim. The
summarization call is pinned to `gemini-3.6-flash` at 1,024 tokens regardless of
the user's selection, so summarizing does not get more expensive when someone
picks a longer response. The 200-word target is an instruction, not an enforced
limit, and summarization adds a second model call to whichever request triggers
it.

`save_conversation` stores exactly what the summarizer returned plus the new
exchange, and **must not apply its own trim**. Capping storage at
`KEEP_RECENT_MESSAGES` looks like the obvious way to bound the row and would
silently disable summarization, because history would never reach 12. The bound
already exists: history grows 2, 4, 6 ... 12, the summarizer collapses it back
to 6, and the row settles between 8 and 12 messages.

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
| Response cache | `cached_api_call` | Repeat prompts skip the model entirely |
| Retry ceiling | `RETRY_ATTEMPTS` | Bounds wasted calls against a throttled quota |
| Summarization | `summarize_if_needed` | Caps how much history is resent |

The client sends the word `short`/`medium`/`long`; the server maps it to a token
number. Keep it that way - the client must not be able to name an arbitrary
ceiling.

The rate limiter holds a `deque` of monotonic timestamps per user id behind a
lock, expires entries older than the window, and raises 429 with a `Retry-After`
header. It lives in process memory: each worker counts separately and a restart
clears the counts.

## Retry and backoff

Two different 429s exist here and only one is retried. `check_chat_rate_limit`
returning 429 to the browser is the client's to wait out; a 429 from Gemini
means the quota is throttling us, and `retrying_api_call` handles it.

`RETRY_STATUS_CODES` covers 429 plus transient 5xx. Anything else - a bad model
name is a 400 - re-raises immediately, because retrying a deterministic failure
only makes the user wait for the same error. Delays double from
`RETRY_BASE_DELAY`, cap at `RETRY_MAX_DELAY`, and are multiplied by a random
0.5-1.5 factor so that simultaneously throttled requests do not retry in
lockstep and collide again. Once attempts are exhausted the route raises 503
with a message the composer can display.

The endpoint is `def`, not `async def`, so it runs in a threadpool and `sleep`
blocks a worker thread. Worst case with the current constants is roughly 4.5
seconds. Raising `RETRY_ATTEMPTS` raises that geometrically and can starve the
threadpool - keep it low.

## Response cache

`cached_api_call` wraps `real_api_call` through `retrying_api_call`; the API
module supplies the `cached_call` adapter so replies and summaries share one
cache. The layering is **cache, then retry, then Gemini**: a hit never enters
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
private history is exposed. The cache is per process: workers do not share it
and a restart empties it. Redis is the answer if that stops being acceptable.

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

`MarkdownMessage` maps each markdown element to theme tokens explicitly, because
this project has no typography plugin (Tailwind v4, configured in `index.css`).
User messages are not passed through it - they render as plain pre-wrapped text.
Note that react-markdown dropped the `inline` prop in v9, so the widely copied
`code: ({ inline }) => ...` pattern silently takes the wrong branch; inline
styling is the default here and `pre` resets it for the block it wraps.

When the response carries `truncated`, the bubble shows a note that the length
limit cut the reply short.

## Known gaps

- Loading a conversation restores only the stored window, at most about a dozen
  messages. Older turns exist only inside the summary.
- No way to rename or delete a conversation.
- Rate limit and cache are per process, not shared across workers.
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

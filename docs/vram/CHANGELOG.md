# Admin documentation changelog

## Unreleased

### Added

- Added optional Redis backing for the chat rate limiter and response cache via
  `REDIS_URL`. Unset, both stay in process memory exactly as before. Set, the
  limiter runs as an atomic Lua sliding window shared by every worker and the
  cache moves to Redis keys with a TTL. A Redis failure degrades to in-process
  state rather than breaking chat. See [AI chat](ai-chat.md#shared-state-redis).

- Added per-call Gemini token logging in `call_agent` (`prompt_token_count`,
  `candidates_token_count`, `total_token_count`), labelled `reply` or `summary`.
  A cache hit reaches no API call and so logs nothing, which is what makes the
  hit rate measurable. `POST /chat` also returns the turn's `usage`, summed
  across both calls when a turn summarizes, and the composer shows it under the
  reply. See [AI chat](ai-chat.md#token-usage).

- Added rename and pin to `POST /conversation-settings`, alongside archive and
  delete. Rename opens a modal and validates a non-blank title within 80
  characters; pin toggles a new `pinned` column that sorts above everything
  else in the rail. See [AI chat](ai-chat.md#conversation-actions).

- Added column-change recipes to the [migrations](migrations.md) guide: adding,
  dropping, renaming, and retyping a column, why autogenerate emits a destructive
  drop/add for a rename, and the layers to check after a column changes.

- Added the [AI chat](ai-chat.md) guide as the single owner of the chat
  endpoint, conversation memory, cost controls, and composer; the API and
  frontend guides now point to it.

- Added an LRU response cache keyed on prompt, model, and token limit, with a
  one-hour expiry and a 256-entry ceiling. Replies and summaries share it;
  empty replies are not stored.

- Created `docs/vram/` as the admin workflow documentation hub, with architecture,
  admin processes, generated modules, profile/navbar, themes, response notifications,
  operations, and change-process guides.

### Changed

- Lazy-loaded the chat route in `App.jsx` with `React.lazy` and `Suspense`, so
  react-markdown ships in its own chunk. The main bundle dropped from 639 kB to
  458 kB (198 kB to 145 kB gzipped) and the 500 kB chunk warning is gone.

- Non-retryable Gemini errors now return 502 with the provider's message instead
  of escaping the route as an unhandled `APIError`. FastAPI turned those into a
  bare 500 with no `detail`, so the composer showed only its generic fallback
  and the real cause - a retired model id, for instance - was invisible.

- Removed `gemini-2.5-flash` from `ChatRequest` and the composer's model list.
  The API returns 404 "no longer available to new users" for it.

- Renamed the chat model-call stack so the layering reads in order:
  `real_api_call` to `call_agent`, `retrying_api_call` to
  `call_agent_with_retry` (provider-neutral: only `call_agent`'s body is
  Gemini-specific), `cached_api_call` to `call_with_cache`, and the
  `cached_call`/`cached_summary_call` adapters to `reply_call`/`summary_call`.
  `call_agent`'s parameters are now `prompt` and `max_output_tokens`; the old
  `message` and `response_length` names described neither, and
  `response_length` collided with the request field of the same name that
  carries `short`/`medium`/`long`.

- Made `conversation_id` required on `ConversationSettings` and removed its
  unused client-supplied `archived_at`. With the id optional,
  `load_conversation` created a new conversation and the endpoint then archived
  or deleted that new row.

- Moved chat memory into the `chat_conversations` table. `POST /chat` now takes
  `conversation_id` instead of client-supplied `history` and `summary`, closing
  the path that let a browser inject text into the prompt. Added
  `GET /chat/conversations` and `GET /chat/conversations/{id}`, both scoped to
  the caller, and a conversation rail in the composer.

- Added exponential backoff with jitter for Gemini 429 and transient 5xx
  responses. Non-retryable statuses re-raise immediately; exhausted retries
  return 503. Layering is cache, then retry, then the model call.

- Assistant replies render as themed markdown, and a reply cut short by the
  output token cap is now labelled as such. Model calls return
  `ModelReply(text, truncated)` so the cache preserves the flag.

- Sized the reply reveal so any length finishes in about 60 ticks, instead of
  three characters per tick.

- Moved conversation helpers into `chat_helpers.py` alongside the existing
  rate limiter. Routing, Gemini setup, and `real_api_call` remain in the API module;
  the summarization helper receives the API function as a callback.

- Restyled the chat composer with a theme-colored surface, combined settings selector,
  and circular send control.

- Added chat summary, prompt, and response helpers behind the simplified endpoint.

- Corrected the chat character counter, consolidated errors into one accessible
  alert, and cleared stale errors when typing while retaining the 2,000-character limit.

- Consolidated project documentation under `docs/vram/`; removed duplicate root
  guides, the superseded design spec, and repeated API feature pages.
- Replaced obsolete setup instructions with the current environment-based
  configuration and reviewed migration workflow.
- Kept module extension details, API contracts, and Laravel correspondence in
  dedicated references; simplified project entry points.

## Baseline - 2026-09-07

Recorded from the current working tree; this is not a reconstructed release history.

- React/FastAPI admin shell with generated module routing and users/roles forms.
- Shared React Toastify provider; login notifications have charcoal styling and
  colored success/error icons.
- Profile response handling and shared navbar image updates without browser reloads.
- Black theme uses login charcoal surfaces with mint-green accents.
- Documented incomplete privilege enforcement, placeholder modules, legacy password
  recovery components, and the difference between local logout and backend revocation.

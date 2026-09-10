# Admin documentation changelog

## Unreleased

### Added

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

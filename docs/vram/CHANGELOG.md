# Admin documentation changelog

## Unreleased

- Reorganized the shell directly into Next.js `app/dashboard`, `components`,
  `context`, `config`, `lib`, and `types`. Removed the staging folder and route
  group; the dashboard page now owns its content and uses its own layout.
  Converted migrated components, utilities, props, state, and API response shapes
  to TypeScript. Branding and avatars use Next.js Image with original URLs and
  dimensions. The existing React design and `/dashboard` URL are preserved.
  Production build and lint passed without warnings. Mocked Chrome checks passed
  for black/light themes at 1280px/390px, session restoration on refresh, mobile
  sidebar controls, logout, logged-out redirects, and no horizontal overflow or
  page errors. All 99 local documentation links resolve. No real API/database
  mutations were exercised.

- Migrated the original React shell and dashboard into Next.js:
  role themes, navbar, backend-loaded sidebars, breadcrumbs, footer, account and
  notification dropdowns, and logout confirmation. Reused the user's existing
  auth wrapper. Preserved the React presentation classes while replacing React Router
  navigation and adding typed providers. Kept account menus inside the viewport
  and allowed narrow dashboard cards to shrink. Branding assets are copied;
  profile uploads have a git-ignored local snapshot, not a storage migration.
  Production build passed. Lint passed with three warnings (two retained image
  elements and one pre-existing unused toast type). Mocked Chrome checks passed
  for black/light themes at 1280px/390px, sidebar toggles, logout cancellation and
  confirmation, logged-out redirects, no horizontal overflow, and no page errors.
  Real API/database mutations were not exercised. Module pages and policy/
  announcement gates remain pending.

- Updated documentation for the ongoing migration to `frontend-next/`: made
  Next.js the frontend development target, replaced its scaffold README, and
  documented routes, providers, API calls, startup, CORS, and verification commands.
  Marked remaining admin workflows as legacy `frontend/` features and retained
  the backend's actual profile storage paths. Verified by source inspection and
  local documentation link checks; no application build, browser checks, or
  database mutations were performed for this documentation-only update.

- Synced documentation with menu-management changes through `e8c660d`: creation
  and edit saves now persist menu rows and role assignments, with shared form
  fields and an inactive section. Replaced the debug-stub availability claim
  and documented actual response shapes, validation gaps, and remaining role,
  status, slug, and inactive-drag UI limitations. Aligned local startup and API
  documentation with the shared client's hardcoded port 8080. Verified by source
  inspection and local documentation link checks; no browser or database
  mutations were exercised for this documentation-only update.

### Earlier changes

- Documented the menu edit modal, its role multi-select and Route/URL selector,
  and the separate `/menus/roles` options endpoint. Recorded the direct-array
  response fix (`res.data`, not `res.data.roles`) and the distinction between
  `{value, label}` options and `{id, name}` assignments. Corrected availability:
  at that point the pencil opened a draft, but `post_update` returned a debug dump
  instead of saving fields or role assignments. Verified against current source;
  this documentation update did not exercise browser editing or API mutations.

- Tightened menu spacing from 32-pixel gaps to stable 8-pixel gaps, replacing
  the tall placeholder with an overlaid insertion line. Added grip indicators,
  child guide lines/counts, and a compact header with save status. Production
  build passed. Isolated Chrome checks with built CSS and mock menus covered
  dark/light at 1100px/390px, no horizontal overflow, and stable native drag
  startup on all four cards. Live database saves and touch dragging were not tested.

- Fixed native menu drags cancelling at startup when expanding gaps and mounting
  empty child areas shifted the source card. Gaps now keep their height and child
  areas stay mounted; labels disable text selection. An isolated headless Chrome
  check with mock menu data reproduced early drag cancellation before the fix
  and verified stable native drags on three root cards and one child afterwards.
  This browser check uses simplified layout CSS, not the authenticated app or DB.

- Fixed menu root targets defaulting to forbidden nesting across most of their
  width. Nesting now uses deliberate horizontal movement, while cards accept
  before/after drops. Added a move-request timeout and server-order reload so
  stalled saves cannot leave the page indefinitely displaying a save lock.
  Production build and mocked save-lock checks passed for success, rejection,
  timeout recovery, and failed recovery; browser interaction was not tested.

- Completed the menu drag UI for the existing `post_move` handler: insertion
  gaps show a dashed, indented destination preview; empty parents accept children;
  root/child ordering, promotion, and cross-parent child moves use one save path.
  Corrected downward gap insertion and blocked overlapping saves. Removed the
  old recursive card drop area and duplicate `renderGroup` declaration.
  Verified the production build, move logic with Node assertions, and backend syntax with Python AST;
  browser interaction and live database persistence were not exercised.

### Added

- Added top-level menu reordering. `/menus` cards are draggable through the
  browser's native drag events - no drag-and-drop library was added - and
  `POST /menus/reorder` takes `{ids: [...]}` in the new order and assigns
  `sorting` from each id's position, so the client never sends a sort number of
  its own. The action filters to `parent_id IS NULL`, assigns through the ORM
  and commits once, so a failure cannot leave a partial order; an id that is
  missing or not top-level returns 422. The page reorders optimistically and
  restores the pre-drag array on a failed save.

  It is not a port of Laravel's `autoUpdateMenu`, which posts the whole nested
  `items` array, rewrites `parent_id` on every row, saves each model separately
  and re-seeds a session cache this port does not have. Children are rendered
  but not draggable, so cross-parent moves and the `parent_id` writes they need
  are still unwritten. See
  [admin processes](admin-processes.md#reordering).

- Renamed `adm_password_history.updated_by` to `created_at` and retyped it from
  `Integer` to `DateTime`, so the history row records when a password was set.
  The rename is hand-written because autogenerate emits a destructive drop/add
  for one, and the type change passes `postgresql_using`, since PostgreSQL has
  no implicit cast from integer to timestamp. The model previously declared
  `updated_at` twice and no `created_at` at all, so `save-change-password`
  raised `TypeError` when appending a history row. See
  [migrations](migrations.md#rename-a-column).

- Added the `adm_menus_roles` pivot, so a menu can be granted to several roles
  instead of the single `adm_menuses.id_adm_role` column. Its migration
  backfills the existing assignments and adds a unique constraint on
  `(id_adm_menus, id_adm_role)`, which Laravel lacks - it avoids duplicates by
  diffing in PHP. `/user_sidebar` now filters on the pivot, matching
  `CommonHelpers::sidebarMenu()`'s subquery against `adm_menus_privileges`;
  the table is renamed because `privileges` in this port already means the
  module permission flags in `adm_roles_privileges`. `id_adm_role` is left in
  place, unread, until the menu screen is finished. See
  [admin processes](admin-processes.md#menus-and-branding).

- Implemented `MenusController.get_index` and a read-only `/menus` page listing
  each active menu as a card with its assigned roles, plus its one level of
  children. It is a custom page rather than a generated module: the screen has
  no table, so it declares no `table_fields`. Create, edit and delete are not
  implemented; the previous `menus/index.jsx` was a copy of the roles
  page and rendered `GeneratedModulePage` against columns `adm_menuses` does
  not have. See [admin processes](admin-processes.md#menu-management).

- Added the forced password change from the Laravel original. `GET
  /password-policy` reports whether the caller is on the default `qwerty`
  password or one older than three calendar months, and whether a waiver is
  still available; `POST /waive-change-password` stamps the date and increments
  `waiver_count`. `ForcePasswordGate` in `App.jsx` shows a non-dismissible
  modal ahead of the announcement gate. Three deliberate departures from
  Laravel: a null `last_password_updated` counts as expired rather than being
  silently exempted by `Carbon::parse(null)`; the waiver cap compares `>=`
  instead of `=== 4`, which let a count of 5 waive again; and the waive
  endpoint re-checks the default-password rule server-side, where the original
  relied only on hiding the button. `/check-waive` is not ported - its
  inverted boolean `status` is folded into `can_waive`. See
  [admin processes](admin-processes.md#forced-password-change).

- Extracted `components/form/ChangePasswordForm.jsx` and
  `hooks/useSignOutCountdown.js` so the `/change-password` page and the forced
  modal share one form and one sign-out countdown. The Laravel original keeps
  two copies of this form, which have since drifted. `Modal` gained
  `dismissible` and `widthClass` props, both defaulting to current behaviour.

### Fixed

- Gave `body` the themed `--bg`/`--text` pair. Nothing set a document text
  colour: `AppContent` painted `bg-skin-bg` but no colour, and the only
  `color: var(--text)` was scoped to `.login-theme`. Any element that declared
  no colour of its own therefore fell back to the browser default black, which
  disappears against the black theme's `#0f1115`/`#171a21` surfaces - modal and
  panel headings inherited rather than declared one. See
  [frontend](frontend.md#theme-process).

### Changed

- Rebuilt the change-password page on the shared theme tokens. It previously
  branched on `isDark` with fixed grey and sky colours, so it ignored the
  role's `theme_color` entirely; surfaces, text, inputs, focus rings and the
  submit button now read `--skin-*`/`--app-theme-*`, and the button uses
  `text-theme-contrast` so its label stays readable on any accent. Validation
  colours on the strength meter and requirement ticks stay fixed on purpose.
  A successful change now counts down from three in both the toast and the
  page before signing out, replacing a `Swal.fire` confirm that could not run
  (`Swal`, `swalColor` and Inertia's `router` were all undefined here, and
  `sweetalert2` is not a dependency). Also fixed `<Link href>` to `to`, which
  had left the Dashboard link inert.

- Added stub mode for chat development. `CHAT_FAKE=1` binds
  `helpers/fake_api.fake_agent_call` in place of `call_agent`, so replies are
  canned and no request reaches the provider, while conversation storage,
  summarization, the rate limiter, the response cache, the retry loop and the
  error conversion all stay in the path. `/long` and `/fail [code] [daily]`
  markers reach the truncation and error branches; stub calls log `stub=1` and
  a warning fires while the setting is on. Defaults to false. The Gemini client
  is now built on first use rather than at import, so a missing `GEMINI_API_KEY`
  fails the first chat request instead of stopping the whole admin API from
  starting - which stub mode would otherwise have been unable to avoid. See
  [AI chat](ai-chat.md#stub-mode).

- Split the chat retry path by which 429 it received. A Gemini 429 carries
  `google.rpc` details, and `quota_refusal` now reads `RetryInfo.retryDelay`
  and `QuotaFailure.violations[].quotaId`: a throttle that clears inside the
  backoff budget is retried as before, while one whose retry hint exceeds
  `RETRY_MAX_DELAY` - an exhausted daily quota - is returned immediately as a
  429 with that delay as `Retry-After`, rather than sleeping ~4.5 seconds
  through three certain failures and reporting "try again shortly". `quotaId`
  picks the wording only. Stub mode gained `/fail 429 daily` so both branches
  are reachable without spending quota. The reading of a Gemini error body now
  lives in `helpers/gemini_errors.py` and stub mode in `helpers/fake_api.py`,
  leaving `api/admin/chat.py` to the real provider call and the routes. See
  [AI chat](ai-chat.md#retry-and-backoff).

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

- Raised `SUMMARIZE_AFTER_MESSAGES` from 12 to 20. The stored window now cycles
  between 8 and 20 messages instead of 8 and 12, so the second model call a
  summarizing turn costs falls on every seventh turn rather than every third -
  roughly 15 to 17.5 turns a day against the free tier's 20-request cap.
  `KEEP_RECENT_MESSAGES` is unchanged at 6, so a summarizing turn still folds
  everything older than the last six messages. See
  [AI chat](ai-chat.md#conversation-memory).

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

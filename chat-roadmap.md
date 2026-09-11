# AI Engineer Roadmap — Progress Checklist

**Current goal: section 5, Agents / Tool Use.** Decided 2026-09-11 — as a
learning and customization goal, not a cost play. Building a personal Claude
Code replacement was priced out: break-even against a ~$20/month subscription is
roughly one coding task per day, and a 7B local model on a 6 GB laptop GPU is
weakest exactly where agents need strength (reliable tool calls over many turns).

## 1. Python Foundations
- [x] Core syntax (indentation, f-strings, no semicolons)
- [x] Data structures (lists, dicts, tuples) — via chatbot.py practice
- [x] Functions, `try/except`, `if __name__ == "__main__"`
- [x] List comprehensions — used throughout `chat_helpers.py`
- [x] Classes/OOP basics — SQLAlchemy models, Pydantic schemas, `@dataclass ModelReply`
- [x] Virtual environments (`venv`) — `backend/venv`
- [x] Closures — `recorded_summary_call` captures a request-local list so a call
      made by `summarize_if_needed` can still be measured

## 2. Calling LLM APIs
- [x] Basic API call (fake stub, then real via Gemini)
- [x] Understand tokens vs. cost, free tier limits — per-call token logging,
      measured cost (~$0.004/message), and the RPD wall on the free tier
- [x] Environment variables / `.env` for API keys
- [x] Multi-turn conversation memory — rolling summary plus a recent window, stored server-side
- [ ] System prompts / prompt engineering basics — templated prompts and the "data, not
      instructions" guard are in; the SDK's `system_instruction` is still unused
- [x] Error handling & retries for API calls — exponential backoff with jitter on 429
      and 5xx; non-retryable errors return 502 with the provider's message, and a
      429 whose own `RetryInfo` outlasts the backoff budget is refused rather than
      retried

## 3. Web App Structure (AI Engineer track)
- [x] FastAPI backend basics (`@app.post`, Pydantic models)
- [x] CORS (why browsers block cross-origin requests)
- [x] React frontend basics (`useState`, `fetch`, event handlers)
- [x] Browser ↔ backend ↔ API request flow
- [x] Real React project setup — Vite
- [x] Code splitting — `React.lazy` + `Suspense` on the chat route

## 4. RAG (Retrieval-Augmented Generation)
- [ ] Feed a document (PDF/text) to the AI
- [ ] Embeddings — what they are, how similarity search works
- [ ] Vector database (Chroma) — store & query embeddings
- [ ] Chunking strategy for large documents

## 5. Agents / Tool Use  ← current focus
- [ ] Function calling — let the AI call your own functions
- [ ] Multi-step agent loops (AI decides what tool to use next)
- [ ] Frameworks (optional): LangChain or LlamaIndex

## 6. Deployment
- [ ] Docker basics (containerize backend)
- [ ] Deploy backend somewhere live (Render, Railway, Fly.io, etc.)
- [ ] Deploy frontend (Vercel/Netlify)
- [ ] Environment variable management in production (not just local `.env`)

## 7. ML / Research Track (not started — separate from AI Engineer track)
- [ ] scikit-learn — train a basic classifier
- [ ] PyTorch fundamentals
- [ ] Train a small neural net (MNIST digit classifier)
- [ ] Understand training loops, gradients, overfitting

## 8. Applying to Your Own Projects
- [ ] Vram Admin Template — RBAC admin, FastAPI + React (in progress; AI chat feature shipped)
- [ ] CardMarket PH — buy/sell marketplace app (planned, not yet started)
- [x] Consider: could either project use an AI feature? — Vram's AI chat

---
**Legend:** `[x]` = done · `[ ]` = not yet covered

Everything shipped on the chat feature is documented in `docs/vram/ai-chat.md`:
Flash-only models, message length cap, summarization, recent-window trim,
submission locking, per-user rate limiting, output token cap, response cache,
exponential backoff with an immediate refusal for a quota that cannot clear,
database-backed summaries, per-call token logging, conversation
rename/pin/archive/delete, optional Redis-backed shared state, and a stub
provider for development.

---

## Todo

### Section 5 — Agents / Tool Use
- [ ] One tool, one round trip, no loop. Define a function, pass it to
      `generate_content`, watch the model choose to call it instead of answering.
- [ ] Add the loop: execute the tool, feed the result back, repeat until the model
      answers with text instead of a tool call.
- [ ] Point tools at vram-py's own FastAPI endpoints — query admin data, list
      modules, scaffold a controller. This is where a custom agent beats a general
      one, and the narrow scope is what makes it work.
- [ ] Watch the cost. Agents burn 10–40× a chat turn; the token logging from
      section 2 is already in place to measure it.

### Cost
- [ ] **`system_instruction` for the persona.** Note it will *not* cut tokens — it is
      sent every request and counted in `prompt_token_count`. The real win is
      separating instructions from data, which hardens the "data, not instructions"
      guard. `cached_content` is the feature that actually discounts reuse.

### Experience
- [ ] **Stream replies** with `generate_content_stream` and a `StreamingResponse`,
      then drop the simulated typing reveal. Harder than it looks:
      - The `Depends(get_db)` session closes before the generator body runs, so
        `save_conversation` needs its own `SessionLocal()`.
      - Retry only works before the first chunk; after that bytes are already sent.
      - `usage_metadata` and `finish_reason` arrive on the *last* chunk.
      - The JSON body (`conversation_id`, `truncated`, `usage`) has to become SSE
        events, which rewrites `sendMessage` too.
- [ ] **Attachments** — the `+` control is still a disabled placeholder. Two things
      to plan first: a file changes the reply but lives outside the prompt string, so
      it must enter `cache_key`; and `MAX_MESSAGE_LENGTH` doesn't bound images or
      PDFs, which need their own token budget.

### Someday
- [ ] Code-split the remaining routes. `Chat` is lazy-loaded; `Dashboard`,
      `ModuleRoute` and `Profile` are still in the 458 kB main bundle.
- [ ] Reconcile logged token totals against the Gemini dashboard once billing is
      enabled — retried-but-billed calls never reach the log, so a gap is expected.

---

## Done

- **`SUMMARIZE_AFTER_MESSAGES` 12 → 20** — the stored window now cycles 8 → 20
  instead of 8 → 12, so the extra summary call falls on every seventh turn
  rather than every third: ~15 → ~17.5 turns a day against the 20-request cap.
  The token side still depends on `M`, the average tokens per stored message
  (break-even ~80, since output costs 5× input) — read it off the logs, where
  `in=` grows by about `2M` per pass-through turn.
- **Stub mode for development** — `CHAT_FAKE=1` binds `fake_api.fake_agent_call`
  in place of `call_agent`, so a turn costs no quota while storage,
  summarization, the rate limiter, the cache, the retry loop and the error paths
  all still run. `/long` and `/fail [code] [daily]` drive truncation and every
  error branch. The token log marks stub calls `stub=1` and a warning fires at
  import, so a stub reply cannot be mistaken for a real one. The Gemini client
  moved to first-use construction so the backend starts with no API key at all.
  This was the prerequisite for section 5: 20 requests a day does not cover an
  agent loop.
- **Split the 429 retry** — `quota_refusal` reads `RetryInfo.retryDelay` and
  `QuotaFailure.violations[].quotaId` off the error. A per-minute throttle still
  backs off and retries; a 429 whose own retry hint is longer than
  `RETRY_MAX_DELAY` is refused immediately as a 429 carrying that delay as
  `Retry-After`, instead of stalling ~4.5s to report "try again shortly". The
  `quotaId` window only picks the wording, so "the daily quota has run out" is
  never said about a different limit. `/fail 429` and `/fail 429 daily` reach
  both branches in stub mode.
- **Per-call token logging** — `call_agent` logs `in=`/`out=`/`total=` labelled
  `reply` or `summary`. A cache hit makes no call and so logs nothing, which is how
  the hit rate becomes visible. `POST /chat` also returns the turn's `usage` and the
  composer shows it under the reply.
- **Rename, pin, archive, delete conversations** — the kebab blocker is gone; it was
  already a real `<button>` outside the row button. Rename uses a modal, pin toggles
  a `pinned` column that sorts first.
- **Redis-backed limiter and cache** — optional via `REDIS_URL`. Unset keeps
  in-process behaviour, so one worker needs no Redis. The limiter runs as an atomic
  Lua sliding window shared across workers.
- **Code-split the chat page** — main bundle 639 kB → 458 kB (198 → 145 kB gzipped),
  and the 500 kB warning is gone.
- **Measured the economics** — ~$0.004 per message on Gemini 3.6 Flash, usage-based
  with no fixed fee; prices double 2027-01-01. `gemini-2.5-flash` is retired and now
  404s, so 3.6 Flash and its 20 RPD free-tier cap is what's available.

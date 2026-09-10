# AI Engineer Roadmap — Progress Checklist

## 1. Python Foundations
- [x] Core syntax (indentation, f-strings, no semicolons)
- [x] Data structures (lists, dicts, tuples) — via chatbot.py practice
- [x] Functions, `try/except`, `if __name__ == "__main__"`
- [x] List comprehensions — used throughout `chat_helpers.py`
- [x] Classes/OOP basics — SQLAlchemy models, Pydantic schemas, `@dataclass ModelReply`
- [x] Virtual environments (`venv`) — `backend/venv`

## 2. Calling LLM APIs
- [x] Basic API call (fake stub, then real via Gemini)
- [x] Understand tokens vs. cost, free tier limits
- [x] Environment variables / `.env` for API keys
- [x] Multi-turn conversation memory — rolling summary plus a recent window, stored server-side
- [ ] System prompts / prompt engineering basics — templated prompts and the "data, not
      instructions" guard are in; the SDK's `system_instruction` is still unused
- [x] Error handling & retries for API calls — exponential backoff with jitter on 429 and 5xx

## 3. Web App Structure (AI Engineer track)
- [x] FastAPI backend basics (`@app.post`, Pydantic models)
- [x] CORS (why browsers block cross-origin requests)
- [x] React frontend basics (`useState`, `fetch`, event handlers)
- [x] Browser ↔ backend ↔ API request flow
- [x] Real React project setup — Vite

## 4. RAG (Retrieval-Augmented Generation)
- [ ] Feed a document (PDF/text) to the AI
- [ ] Embeddings — what they are, how similarity search works
- [ ] Vector database (Chroma) — store & query embeddings
- [ ] Chunking strategy for large documents

## 5. Agents / Tool Use
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

The shipped cost-control work (Flash-only models, message length cap, summarization,
recent-window trim, submission locking, per-user rate limiting, output token cap,
response cache, exponential backoff, database-backed summaries) is documented in
`docs/vram/ai-chat.md`.

---

## Todo — remaining

**Measure before tuning**
- Log `usage_metadata` per call (`prompt_token_count`, `candidates_token_count`,
  `total_token_count`) so cost is measured instead of estimated. Cache hits produce
  no log line, which is how the hit rate becomes visible.
- Check those numbers against the Gemini API dashboard for billing ground truth.

**Cost**
- Widen the summarization gap. It currently cycles 8 → 10 → 12 → 8 messages, so the
  extra summary call fires every third turn. `SUMMARIZE_AFTER_MESSAGES = 20` would
  make it every seventh, trading more verbatim history per request.
- Use `system_instruction` for the assistant's persona instead of prefixing it onto
  every prompt.

**Experience**
- Stream replies with `generate_content_stream` and a `StreamingResponse`, then drop
  the simulated typing reveal. Needs the stream accumulated server-side so the cache
  and `save_conversation` still see one complete reply.
- Rename and delete conversations. The kebab is a `<span>` inside the row `<button>`,
  so it has to move outside before it can be a real button.
- Attachments — the `+` control is a disabled placeholder.

**Before more than one worker**
- Move the rate limiter and response cache to Redis. Both are per process today, so
  each worker counts and caches separately.

**Cleanup**
- Delete the unused `build_chat_response` function and its import in `chat.py`.
- Code-split the chat page; the bundle grew to 632 kB after react-markdown.

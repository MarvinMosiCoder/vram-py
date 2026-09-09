# AI Engineer Roadmap — Progress Checklist

## 1. Python Foundations
- [x] Core syntax (indentation, f-strings, no semicolons)
- [x] Data structures (lists, dicts, tuples) — via chatbot.py practice
- [x] Functions, `try/except`, `if __name__ == "__main__"`
- [ ] List comprehensions (practice on your own)
- [ ] Classes/OOP basics
- [ ] Virtual environments (`venv`) — you've used `.env` files, but not yet `venv` for dependency isolation

## 2. Calling LLM APIs
- [x] Basic API call (fake stub, then real via Gemini)
- [x] Understand tokens vs. cost, free tier limits
- [x] Environment variables / `.env` for API keys
- [ ] Multi-turn conversation memory (Gemini version doesn't remember history yet — flagged, not built)
- [ ] System prompts / prompt engineering basics
- [ ] Error handling & retries for API calls (rate limits, timeouts)

## 3. Web App Structure (AI Engineer track)
- [x] FastAPI backend basics (`@app.post`, Pydantic models)
- [x] CORS (why browsers block cross-origin requests)
- [x] React frontend basics (`useState`, `fetch`, event handlers)
- [x] Browser ↔ backend ↔ API request flow
- [ ] Real React project setup (Vite/CRA) — current frontend uses CDN React, not a real build

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
- [ ] Vram Admin Template — RBAC admin, FastAPI + React (in progress, separate learning track)
- [ ] CardMarket PH — buy/sell marketplace app (planned, not yet started)
- [ ] Consider: could either project use an AI feature? (e.g., AI-assisted card search/description in CardMarket PH)

---
**Legend:** `[x]` = done together in this conversation · `[ ]` = not yet covered


Todo Lists
Use a cheaper/faster model for normal chat, such as a Flash variant.
Limit message length before sending.
Summarize old conversation history instead of resending every message.
Keep only the last few messages in context.
Add frontend debounce/submission locking to prevent duplicate requests.
Add backend per-user rate limiting, for example 10 requests per minute.
Set a maximum output token limit if supported by the SDK.
Cache identical prompts and common responses.
Use exponential backoff for 429 responses.
Track usage and costs through the Gemini API dashboard.
Store a conversation summary in the database rather than the entire transcript.
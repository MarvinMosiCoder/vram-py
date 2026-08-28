# Vram Admin Template — RBAC starter

FastAPI (Python) backend + React (Vite) frontend, with JWT auth and
role-based access control (admin / editor / viewer).

See `STUDY_GUIDE.md` for a full explanation of every part, or the
[`docs/`](docs/) folder for reference documentation:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system overview, auth flow, RBAC model
- [docs/API.md](docs/API.md) — full API reference
- [docs/MIGRATIONS.md](docs/MIGRATIONS.md) — Alembic setup and migration workflow

## Quick start

**Backend**
```bash
cd backend
python -m venv venv
venv\Scripts\Activate.ps1      # Windows
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload
```
API runs at http://localhost:8000 — interactive docs at http://localhost:8000/docs

**Frontend** (new terminal)
```bash
cd frontend
npm install
npm run dev
```
App runs at http://localhost:5173

**Default login:** `admin@vram.com` / `admin123`

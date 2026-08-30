# Vram Admin Template — RBAC starter

FastAPI (Python) backend + React (Vite) frontend on PostgreSQL, with JWT
auth and role-based access control (admin / editor / viewer).

See `STUDY_GUIDE.md` for a full explanation of every part, or the
[`docs/`](docs/) folder for reference documentation:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system overview, auth flow, RBAC model
- [docs/API.md](docs/API.md) — full API reference
- [docs/DATABASE.md](docs/DATABASE.md) — PostgreSQL setup, psql basics, troubleshooting
- [docs/MIGRATIONS.md](docs/MIGRATIONS.md) — Alembic setup and migration workflow

## Quick start

**Database** — needs a local PostgreSQL server; the defaults live in
`backend/app/core/database.py` (user `vram`, password `vram`, port `5432`).
Full walkthrough in [docs/DATABASE.md](docs/DATABASE.md):
```bash
psql -U postgres -c "CREATE USER vram WITH PASSWORD 'vram';"
psql -U postgres -c "CREATE DATABASE vram_admin OWNER vram;"
```

**Backend**
```bash
cd backend
python -m venv venv
venv\Scripts\Activate.ps1      # Windows
pip install -r requirements.txt
alembic upgrade head           # create the tables
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

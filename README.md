# Vram Admin Template — RBAC starter

FastAPI (Python) backend + React (Vite) frontend on PostgreSQL, with JWT
auth and role-based access control (admin / editor / viewer). Styling is
hand-written CSS plus Tailwind v4, sharing one palette that follows the
signed-in user's role theme — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#styling-and-theming).

It is a port of a Laravel + Inertia admin template of the same name,
including its metadata-driven module system — a row in `adm_modules` plus
a declarative controller class gives you a searchable, sortable,
paginated CRUD API with no new route and no new React page. **Coming from
Laravel? Start with [docs/LARAVEL.md](docs/LARAVEL.md)**, which maps the
whole stack concept by concept.

See `STUDY_GUIDE.md` for a full explanation of every part, or the
[`docs/`](docs/) folder for reference documentation:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system overview, auth flow, RBAC model
- [docs/MODULES.md](docs/MODULES.md) — the dynamic module system, its guards, and how to add a module
- [docs/LARAVEL.md](docs/LARAVEL.md) — Laravel → Python: routes, Eloquent, Inertia, migrations, auth
- [docs/API.md](docs/API.md) — full API reference
- [docs/api/modules.md](docs/api/modules.md) — the dynamic module routes, parameters, and errors
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

# Vram Admin — Study Guide

Your notes from building a Python (FastAPI) + React admin template with
role-based access control (RBAC). Read this alongside the code in
`backend/` and `frontend/`.

## 1. Installing Python & setting up a project (Windows)

- Install from python.org, **checking "Add python.exe to PATH"** during
  install — this is what lets you type `python` in any terminal.
- `python --version` confirms the install worked.
- Project folders: `backend/` (Python) and `frontend/` (React) live
  side by side — they're two separate servers that talk over HTTP,
  not one combined app.

## 2. Virtual environments (`venv`)

A Python-specific concept with no real JS equivalent: an isolated
folder holding its own copy of Python + installed packages, so one
project's dependencies never clash with another's.

```bash
python -m venv venv          # create it
venv\Scripts\Activate.ps1    # activate it (Windows PowerShell)
```

You know it's active when your prompt shows `(venv)`. You activate it
every time you open a new terminal for this project. If PowerShell
blocks activation, run once:
`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

## 3. Installing packages with pip

```bash
pip install fastapi uvicorn sqlalchemy python-jose passlib python-multipart bcrypt
```

- **fastapi** — the web framework (defines your API routes)
- **uvicorn** — the server that actually runs FastAPI and listens on a port
- **sqlalchemy** — ORM: write Python classes instead of raw SQL
- **python-jose** — creates/verifies JWT login tokens
- **passlib + bcrypt** — securely hash passwords (never store plain text)
- **python-multipart** — lets FastAPI parse login form data

## 4. Python syntax notes for someone coming from JS/React

- No `{}` braces or semicolons — **indentation is syntax**, not style.
- `import x from "y"` (JS) → `from y import x` (Python), no curly braces.
- `class Name(Parent):` is how inheritance is written (vs `extends`).
- `__tablename__` (double underscores) is a Python convention for
  "special" attributes frameworks look for — not something you invent.
- Python variables: just `name = value` — no `const`/`let`/`var`.

## 5. Database models (`backend/app/models/__init__.py`)

Four tables now:

- **Role** (`adm_roles`) — `id`, `name`, `is_superadmin`, `theme_color`.
  Only one row is seeded (`Super Administrator`, id `1`) — the model
  supports more roles, nothing creates them yet.
- **User** (`adm_users`) — `id`, `email`, `password` (bcrypt hash),
  `id_adm_role` (FK -> Role), `token_version` (bumped on logout to
  revoke old tokens).
- **Modules** (`adm_modules`) — a registerable feature area: `name`,
  `icon`, `path`, `is_active`, `is_protected` (marks a built-in admin
  module vs. a future user-generated one — not a permission flag).
- **Menuses** (`adm_menuses`) — one sidebar entry: `path`, `icon`,
  `sorting`, `patent_id` (FK -> Modules, its parent), `id_adm_role`
  (FK -> Role, who can see it).

`relationship()` doesn't create a column — it's a SQLAlchemy
convenience so `user.role.name` or `menu.module.is_protected` work in
Python without you writing a manual SQL join.

**Mental model shift from React:** in React, state lives in memory and
re-renders drive the UI. Here, the **database is the state** — every
request opens a session, reads/writes rows, and closes it. Nothing
persists in memory between requests.

## 6. Auth & RBAC (`backend/app/core/auth.py`)

- Passwords are **hashed** with bcrypt before storage — `hash_password()`
  / `verify_password()`. You never store or compare plain text passwords.
- **JWT (JSON Web Token)**: on login, the server creates a signed token
  containing the user's email. The client stores it (here: browser
  `localStorage`) and sends it back on every request as an
  `Authorization: Bearer <token>` header.
- `get_current_user()` runs on every protected route: decodes the
  token, looks up the matching User row.
- `require_role(1)` is the actual RBAC gate — a "dependency factory"
  that blocks the request with `403 Forbidden` before your route code
  runs, if the user's `id_adm_role` isn't in the allowed list. Roles
  are checked by **id**, not name, so renaming a role never breaks a
  route that requires it.
- `RequireAuthMiddleware` (`backend/app/core/middleware.py`) is a
  second, global layer: any route *not* explicitly listed as public
  gets a 401 before it even runs, even if someone forgets to add
  `Depends(get_current_user)` to a new route. Fail-closed by default.

## 7. API routes (`backend/app/api/`)

One file per feature area (`routers.py` just combines them — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for why it's split this
way, and [docs/API.md](docs/API.md) for full request/response shapes):

| Route | Who can access | File |
|---|---|---|
| `POST /register` | anyone | `auth.py` |
| `POST /login` | anyone (returns a JWT) | `auth.py` |
| `POST /logout` | any logged-in user | `auth.py` |
| `GET /me` | any logged-in user | `auth.py` |
| `GET /dashboard` | any logged-in user | `dashboard.py` |
| `GET /sidebar` | any logged-in user (superadmin sees every menu) | `sidebar.py` |
| `GET /admin/users` | role id `1` only | `admin.py` |
| `GET /editor/content` | role id `1` only (no separate editor role yet) | `editor.py` |

`CORSMiddleware` is required because browsers block a page on
`localhost:5173` (React) from calling `localhost:8000` (Python)
without the server explicitly allowing it — a browser security rule,
not a Python one.

## 8. Frontend structure

- **`api.js`** — one shared axios instance; an *interceptor* auto-attaches
  the saved JWT to every outgoing request, so you never repeat that
  logic in each component.
- **`AuthContext.jsx`** — holds the logged-in user in React Context so
  any component can read it via `useAuth()`, instead of prop-drilling.
- **`ProtectedRoute.jsx`** — a wrapper component: redirects to
  `/login` if not logged in, and to `/dashboard` if logged in but the
  role isn't allowed for that route. This is RBAC enforced on the
  frontend (a UX convenience) — the backend's `require_role` is what
  actually enforces it securely, since frontend checks can always be
  bypassed by a determined user.
- **`Sidebar.jsx`** — fetches `GET /sidebar` on mount and splits the
  result into two rendered groups by `module.is_protected` (see
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)'s "Sidebar and menus").
  No hardcoded link list anymore, except `Dashboard` itself.
- **`Dashboard.jsx`** — reads `user.role_id` and conditionally renders
  cards, and separately calls `/admin/users`, which the *backend*
  rejects for non-superadmins regardless of what the frontend shows.

## 9. Running it

```bash
# Backend
cd backend
venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed.py          # creates roles + admin@vram.com / admin123
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`, log in with `admin@vram.com` / `admin123`.
Register a second user via the `/register` endpoint (e.g. through the
FastAPI docs at `http://localhost:8000/docs`) — it's created with no
role (`id_adm_role` is `null`), so logging in as them shows the locked
cards, since none of the role-id checks match.

## 10. Where to go next

- Add a "create user" form in the frontend (admin-only) that calls `POST /register`.
- Add refresh tokens (current JWT expires after 60 minutes, hardcoded in `auth.py`).
- Move `SECRET_KEY` out of the code and into an environment variable.
- Swap SQLite for PostgreSQL by changing one line in `database.py`.

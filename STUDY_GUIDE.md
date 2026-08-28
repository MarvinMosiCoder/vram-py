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

Two tables, linked by a foreign key:

- **Role** — `id`, `name` ("admin" / "editor" / "viewer")
- **User** — `id`, `email`, `hashed_password`, `role_id` (points to a Role)

`relationship()` doesn't create a column — it's a SQLAlchemy
convenience so `user.role.name` works in Python without you writing a
manual SQL join.

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
- `require_role("admin")` is the actual RBAC gate — a "dependency
  factory" that blocks the request with `403 Forbidden` before your
  route code runs, if the user's role isn't in the allowed list.

## 7. API routes (`backend/app/api/routers.py`)

| Route | Who can access |
|---|---|
| `POST /register` | anyone |
| `POST /login` | anyone (returns a JWT) |
| `GET /me` | any logged-in user |
| `GET /dashboard` | any logged-in user |
| `GET /editor/content` | role = admin or editor |
| `GET /admin/users` | role = admin only |

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
- **`Dashboard.jsx`** — reads `user.role` and conditionally renders
  cards, and separately calls `/admin/users`, which the *backend*
  rejects for non-admins regardless of what the frontend shows.

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
Register a second user with role `viewer` via the `/register` endpoint
(e.g. through the FastAPI docs at `http://localhost:8000/docs`) to see
the locked cards in action.

## 10. Where to go next

- Add a "create user" form in the frontend (admin-only) that calls `POST /register`.
- Add refresh tokens (current JWT expires after 60 minutes, hardcoded in `auth.py`).
- Move `SECRET_KEY` out of the code and into an environment variable.
- Swap SQLite for PostgreSQL by changing one line in `database.py`.

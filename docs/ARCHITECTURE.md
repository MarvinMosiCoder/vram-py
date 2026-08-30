# Architecture

Vram Admin is two independent servers that talk over HTTP/JSON — there is
no server-side rendering or shared process:

| | |
|---|---|
| **Backend** | FastAPI (Python), PostgreSQL via SQLAlchemy, JWT auth — `http://localhost:8000` |
| **Frontend** | React (Vite), React Router, axios — `http://localhost:5173` |

```mermaid
flowchart LR
    subgraph Browser
        FE[React app<br/>localhost:5173]
    end
    subgraph Server
        BE[FastAPI app<br/>localhost:8000]
        DB[(PostgreSQL<br/>vram_admin)]
    end
    FE -- "JSON over HTTP<br/>Authorization: Bearer &lt;JWT&gt;" --> BE
    BE -- SQLAlchemy ORM --> DB
```

## Directory layout

```
backend/
  app/
    main.py            FastAPI app, CORS, RequireAuthMiddleware, router mount
    core/
      database.py      engine, session factory, get_db() dependency
      auth.py          password hashing, JWT issuing/verification, RBAC dependency
      middleware.py    RequireAuthMiddleware — fail-closed 401 for any route
                        not in PUBLIC_PATHS, before the route even runs
    models/            SQLAlchemy tables, one file per table
      role.py            Role         -> adm_roles
      user.py            User         -> adm_users
      module.py          Modules      -> adm_modules
      menus.py           Menuses      -> adm_menuses
      admin_menus.py     AdminMenuses -> adm_admin_menuses
      __init__.py        re-exports all five (see "Models and schemas" below)
    schemas/           Pydantic request/response shapes, mirroring models/
      user.py            UserCreate, UserLogin, UserOut
      token.py           Token
      module.py          ModuleOut
      menus.py           MenuOut
      admin_menus.py     AdminMenu
      __init__.py        re-exports all of the above
    api/
      routers.py       combines every feature router below — the only
                        file main.py imports; adding a new feature area
                        means adding a router here, not touching main.py
      serializers.py   User -> UserOut, shared by auth.py and admin.py
      auth.py          /register, /login, /logout, /me
      dashboard.py     /dashboard
      sidebar.py       /sidebar
      admin.py         /admin/users
      editor.py        /editor/content
  alembic/             migration environment + versions/ (see MIGRATIONS.md)
  alembic.ini          alembic config — deliberately has no sqlalchemy.url;
                        env.py injects it from core/database.py
  seed.py              one-off script: creates the Super Administrator role + admin@vram.com

frontend/
  src/
    api.js                 shared axios instance + auth-header interceptor
    context/AuthContext.jsx  global auth state (user, login, logout)
    components/ProtectedRoute.jsx  route guard (auth + role check)
    layout/Sidebar.jsx      fetches GET /admin_sidebar, renders it under "Admin"
    layout/Navbar.jsx
    layout/Layout.jsx
    pages/Login.jsx
    pages/Dashboard.jsx
    App.jsx        route table
    main.jsx       React entry point
```

There is no database file in this tree any more. `backend/app.db` is a
leftover from the SQLite era (gitignored, safe to delete) — the data now
lives in a PostgreSQL server, see [Database](#database) below and
[DATABASE.md](DATABASE.md) for setting one up.

## Backend layers

Each request flows through the same stack:

```
core/middleware.py (RequireAuthMiddleware)
  -> 401 immediately if the path isn't public and there's no valid Bearer token
api/<feature>.py (route, e.g. api/sidebar.py)
  -> Depends(auth.get_current_user) or Depends(auth.require_role(...))
       -> decodes JWT, loads User from DB               [core/auth.py]
  -> Depends(database.get_db)
       -> opens a SQLAlchemy session for this request only  [core/database.py]
  -> models (Role, User, Modules, Menuses) via the SQLAlchemy ORM  [models/]
  -> schemas validates the response shape before it's sent [schemas/]
```

`RequireAuthMiddleware` and each route's `Depends(auth.get_current_user)`
both call the same `auth.get_user_from_token()` — the middleware is a
fail-closed backstop (a route added without an explicit `Depends` is
still protected), the per-route dependency is what actually hands the
`User` object to the route body.

There is no in-memory application state between requests — the database
is the single source of truth. `get_db()` opens a session per request
and closes it in a `finally` block even if the route raises.

## Database

PostgreSQL, reached through SQLAlchemy. Installing it and creating the
`vram_admin` database is a one-time setup, written up in
[DATABASE.md](DATABASE.md). `backend/app/core/database.py` is the single
source of truth for the connection:

```python
DATABASE_URL = "postgresql+psycopg2://vram:vram@localhost:5432/vram_admin"

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)
```

| | |
|---|---|
| `postgresql+psycopg2` | dialect + driver. The driver ships as `psycopg2-binary` in `requirements.txt` — SQLAlchemy on its own cannot speak Postgres's wire protocol. |
| `pool_pre_ping=True` | test a pooled connection with a cheap query before handing it to a request, so a connection the server has since dropped (idle timeout, restart) is replaced instead of blowing up mid-request. |
| `pool_recycle=3600` | retire any connection older than an hour, before Postgres or a proxy in between closes it first. |

Neither pool setting was needed under SQLite — a local file has no server
to hang up on you. They matter now because the database is a separate
process the app holds long-lived TCP connections to. For the same reason
the old `PRAGMA foreign_keys=ON` connect-event hook is gone: SQLite
ignored foreign keys unless that ran on every connection, Postgres
enforces them itself.

`alembic/env.py` imports `DATABASE_URL` from this same module and calls
`config.set_main_option("sqlalchemy.url", ...)`, which is why
`alembic.ini` no longer carries a URL at all — there is exactly one place
to change the connection string, and no way for the app and its
migrations to end up pointed at different databases.

**Migrations are the only thing that creates the schema.** `main.py` used
to call `Base.metadata.create_all(bind=engine)` on startup; that call was
removed, so a fresh database needs `alembic upgrade head` before the app
can serve a request. (`seed.py` still calls `create_all()` so it works on
an empty database — the one remaining way to race alembic, see
[MIGRATIONS.md](MIGRATIONS.md).)

## Models and schemas

Both packages are **one file per area**, named after the thing they
describe, with the package `__init__.py` re-exporting everything:

| | |
|---|---|
| `models/role.py`, `user.py`, `module.py`, `menus.py`, `admin_menus.py` | one SQLAlchemy table each |
| `schemas/user.py`, `token.py`, `module.py`, `menus.py`, `admin_menus.py` | the Pydantic shapes for that area |

The re-exports aren't only a convenience — routes keep writing
`from app import models` / `models.User` rather than a deep import per
class, **and** importing `app.models` is what registers all five tables
on `Base.metadata`. `alembic/env.py` imports exactly that package, so a
new model file that isn't re-exported from `models/__init__.py` is
invisible to `--autogenerate` (see [MIGRATIONS.md](MIGRATIONS.md)).

Models never import each other: SQLAlchemy `relationship()` refers to
the *other class by name as a string* (`relationship("User", ...)`) and
`ForeignKey("adm_roles.id")` names the table, so `Role` <-> `User` stays
a two-way link across two files with no circular import. It is also the
only `relationship()` left — `Modules.menuses` / `Menuses.module` were
dropped when the menu tables were reworked (see "Sidebar and menus"),
and no schema nests another any more, so nothing in `schemas/` imports a
sibling either.

## Auth flow

```mermaid
sequenceDiagram
    participant U as User (browser)
    participant FE as React (AuthContext)
    participant BE as FastAPI
    participant DB as PostgreSQL

    U->>FE: submits login form
    FE->>BE: POST /login (form-encoded username/password)
    BE->>DB: look up User by email
    BE->>BE: verify_password() against bcrypt hash
    BE-->>FE: { access_token, token_type: "bearer" }
    FE->>FE: localStorage.setItem("token", ...)
    FE->>BE: GET /me  (Authorization: Bearer <token>)
    BE-->>FE: { id, email, name, theme_color, role, role_id }
    FE->>FE: AuthContext user = {...}
```

Every subsequent request from the axios instance in `api.js` attaches
`Authorization: Bearer <token>` automatically via a request interceptor,
so individual components never handle the header themselves.

`POST /logout` bumps `adm_users.token_version`; `get_user_from_token()`
rejects any token whose embedded `token_version` no longer matches the
database, so a logged-out token stops working immediately rather than
just being forgotten client-side.

## RBAC model

```mermaid
erDiagram
    ADM_ROLES ||--o{ ADM_USERS : has
    ADM_ROLES {
        int id
        string name
        int is_superadmin
        string theme_color
    }
    ADM_USERS {
        int id
        string email
        string password
        int id_adm_role FK
        int token_version
    }
```

Only one role is seeded today — **Super Administrator** (`id = 1`,
`is_superadmin = 1`) — via `backend/seed.py`. The model supports more
roles (`adm_roles` is a normal table), but nothing in the UI creates
them yet.

Role checks happen in **two places**, deliberately:

- **Backend (`auth.require_role(...)` in `core/auth.py`)** — the real
  enforcement. Checks `id_adm_role` against a set of allowed role ids
  (not names, so a role can be renamed without breaking every route
  that requires it) and returns `403 Forbidden` before the route body
  runs. This cannot be bypassed by the client.
- **Frontend (`ProtectedRoute.jsx`, and conditional rendering in
  `Dashboard.jsx`)** — UX only. Hides links/cards and redirects so users
  don't hit dead ends, but a determined user could edit the JS and see
  restricted UI; the backend check is what actually protects the data.

| Route | Allowed | Enforced by |
|---|---|---|
| `POST /register` | anyone | — |
| `POST /login` | anyone | — |
| `POST /logout` | any authenticated user | `get_current_user` |
| `GET /me` | any authenticated user | `get_current_user` |
| `GET /dashboard` | any authenticated user | `get_current_user` |
| `GET /admin_sidebar` | any authenticated user — no role filter, see [api/sidebar.md](api/sidebar.md) | `get_current_user` |
| `GET /admin/users` | role id `1` | `require_role(1)` |
| `GET /editor/content` | role id `1` (temporary — no editor role exists yet) | `require_role(1)` |

See [API.md](API.md) for full request/response details on each route.

## Sidebar and menus

Three tables sit in this area. Only one of them is currently served by a
route — the split is mid-refactor, and this section describes where it
actually stands rather than where it is heading.

- **`adm_modules`** — a registerable feature area: `name`, `icon`,
  `path`, `table_name`, `controller`, `is_active`, and `is_protected`.
  `is_protected` does **not** mean "requires a role" — it marks a
  built-in admin module (Users Management, Menu Management, etc.) as
  opposed to a future user-generated one. Nothing joins to it any more
  (see below) and no route reads it.
- **`adm_menuses`** — one sidebar entry: `name`, `type`, `path`, `slug`,
  `icon`, `color`, `sorting`, `is_dashboard`, `parent_id` (FK ->
  **`adm_menuses.id`**), and `id_adm_role` (FK -> `adm_roles.id`, who
  can see it). No route reads it right now either.
- **`adm_admin_menuses`** — the table behind the admin sidebar, added
  2026-08-30. Same shape as `adm_menuses` minus `is_dashboard`,
  `id_adm_role`, and any foreign key: `name`, `type`, `path`, `slug`,
  `color`, `icon`, `parent_id`, `is_active`, `sorting`. Seeded with one
  row (`Roles`).

**A menu's parent is another menu, not a module.** `adm_menuses` used to
carry `patent_id`, a typo'd FK into `adm_modules.id`. Migration
`253f97ec1dfd` renamed it to `parent_id` and re-pointed the FK at
`adm_menuses.id`, so `NULL` means top level and any other value names the
accordion group the entry sits under. Existing values were ids from a
different table entirely, so the migration clears them rather than
carrying meaningless numbers across. The `Modules.menuses` /
`Menuses.module` relationship pair went away with the FK — the two tables
have no link left.

`GET /admin_sidebar` (`api/sidebar.py`) reads `adm_admin_menuses`, keeps
`is_active = 1`, orders by `sorting`, and returns a flat list of
`schemas.AdminMenu`. No join, no nested `module` object, and **no role
filter** — the table has no `id_adm_role` column, so every authenticated
caller gets the same menu. See [api/sidebar.md](api/sidebar.md) for the
before/after and the options for restoring role scoping.

`Sidebar.jsx` puts the whole response under the "Admin" heading
(`userMenus` is hardcoded empty) and renders it flat — `parent_id` is
returned but not yet used to nest anything. `Dashboard` is a separate
hardcoded link with no row in any table, since every signed-in user
always sees it.

## Frontend state

- **`AuthContext`** holds `user`, `loading`, `login()`, `logout()` in
  React Context, read anywhere via the `useAuth()` hook — avoids prop
  drilling the current user through every component.
- On mount, if a token is already in `localStorage` (from a previous
  session), `AuthContext` calls `GET /me` to resolve it back into a user
  object; if that fails (expired/invalid/revoked token) it clears the
  stored token and falls back to logged-out.
- **`ProtectedRoute`** reads `useAuth()` and redirects to `/login` if
  there's no user.
- **`Sidebar`** fetches `GET /admin_sidebar` on mount and renders every
  row it gets back under the "Admin" heading — see "Sidebar and menus"
  above. It refetches only on mount, so a menu/role change elsewhere
  requires a page reload to show up, same caveat as `AuthContext`'s
  `user`.

## Configuration notes

These are hardcoded for local development and called out here so
they're not missed before deploying anywhere real:

- `backend/app/core/auth.py` — `SECRET_KEY` is a literal string in source
  and `ACCESS_TOKEN_EXPIRE_MINUTES = 60` with no refresh-token flow.
- `backend/app/core/database.py` — `DATABASE_URL` is a literal
  `postgresql+psycopg2://vram:vram@localhost:5432/vram_admin`, database
  password included. `alembic/env.py` imports it from there, so moving it
  to an environment variable is a one-place change.
- `backend/app/main.py` — CORS is locked to `http://localhost:5173` only.
- `frontend/src/api.js` — `baseURL` is a literal `http://localhost:8000`.

See `STUDY_GUIDE.md` §10 for suggested next steps (env vars, refresh
tokens).

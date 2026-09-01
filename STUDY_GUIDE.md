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
- **alembic** — versioned schema migrations (see [docs/MIGRATIONS.md](docs/MIGRATIONS.md))
- **psycopg2-binary** — the PostgreSQL driver. SQLAlchemy is the ORM, but
  it still needs a driver underneath to speak Postgres's wire protocol.

The authoritative list is `backend/requirements.txt` —
`pip install -r requirements.txt` installs all of it in one go.

## 4. Python syntax notes for someone coming from JS/React

- No `{}` braces or semicolons — **indentation is syntax**, not style.
- `import x from "y"` (JS) → `from y import x` (Python), no curly braces.
- `class Name(Parent):` is how inheritance is written (vs `extends`).
- `__tablename__` (double underscores) is a Python convention for
  "special" attributes frameworks look for — not something you invent.
- Python variables: just `name = value` — no `const`/`let`/`var`.

If you are coming from Laravel/PHP rather than JS, the same ground is
covered from that angle in [docs/LARAVEL.md](docs/LARAVEL.md).

### 4b. Decorators — the one new concept worth real attention

Decorators are everywhere in this project (`@router.get`, `@controller`,
`@action`), and they are the single biggest Python idea in it. A
decorator is just **a function that takes a function and returns a
replacement**. This:

```python
@action
def get_index(self):
    ...
```

is exactly the same as writing `get_index = action(get_index)` after the
definition. Nothing magic, no framework scanning — the line above the
`def` runs once, at class-definition time.

The simplest one in the codebase, in `app/modules/registry.py`, doesn't
even replace anything:

```python
def action(fn):
    fn.__module_action__ = True   # stick a marker on the function object
    return fn                     # hand it back unchanged
```

Functions are objects in Python, so you can hang an attribute off one.
`api/dynamic.py` later checks for that attribute before it will call a
method from a URL. Why bother? Because Python has no `public`/`private`
keyword, so an unguarded `getattr(instance, name_from_url)` could reach
*any* attribute on the object. `@action` is the missing `public`.

`@controller("RolesController")` is one step up — a **decorator factory**,
a function that returns a decorator, so it can take an argument:

```python
def controller(name):          # called with the string
    def decorator(cls):        # ...returns the real decorator
        CONTROLLERS[name] = cls
        return cls
    return decorator
```

`require_role(1)` in `core/auth.py` is the same trick in a different
costume: call it with an argument, get back the function FastAPI will run
per request.

The closest PHP comparison is an attribute you wrote the handler for
yourself; the closest JS one is a higher-order component. See
[docs/MODULES.md](docs/MODULES.md) for how these two decorators become a
whole module system.

## 5. Database models (`backend/app/models/`)

One file per table, all re-exported from `models/__init__.py` so routes
still just write `models.User`. Five tables now, in a PostgreSQL database
called `vram_admin` ([docs/DATABASE.md](docs/DATABASE.md) sets it up):

- **Role** (`adm_roles`) — `id`, `name`, `is_superadmin`, `theme_color`.
  Only one row is seeded (`Super Administrator`, id `1`) — the model
  supports more roles, nothing creates them yet.
- **User** (`adm_users`) — `id`, `email`, `password` (bcrypt hash),
  `id_adm_role` (FK -> Role), `token_version` (bumped on logout to
  revoke old tokens).
- **Modules** (`adm_modules`) — a registerable feature area: `name`,
  `icon`, `path`, `table_name`, `controller`, `is_active`,
  `is_protected` (marks a built-in admin module vs. a future
  user-generated one — not a permission flag). This table went from
  unused to load-bearing: `table_name` and `controller` are what the
  dynamic module system reads on every request (§8).
- **Menuses** (`adm_menuses`) — one sidebar entry: `path`, `icon`,
  `sorting`, `parent_id` (FK -> **Menuses**, the accordion group it sits
  under; `NULL` = top level), `id_adm_role` (FK -> Role, who can see it).
- **AdminMenuses** (`adm_admin_menuses`) — the admin sidebar, added
  2026-08-30: `name`, `type`, `path`, `slug`, `color`, `icon`,
  `parent_id`, `is_active`, `sorting`. Same idea as Menuses but with no
  foreign keys and no role column. This is the one `GET /admin_sidebar`
  actually reads.

`relationship()` doesn't create a column — it's a SQLAlchemy
convenience so `user.role.name` works in Python without you writing a
manual SQL join. `Role` <-> `User` is the only pair using it; the
Modules <-> Menuses pair was dropped when a menu's parent became another
menu instead of a module.

**A self-referencing foreign key** is worth a second look:
`parent_id = Column(Integer, ForeignKey("adm_menuses.id"))` points a
table at *itself*. That is how you store a tree in a flat table — each
row names its parent, and the roots are the rows where the column is
`NULL`. It replaced a column that pointed at a different table entirely,
which is why migration `253f97ec1dfd` clears the old values instead of
keeping them (see [docs/MIGRATIONS.md](docs/MIGRATIONS.md#this-projects-migration-history)).

**Mental model shift from React:** in React, state lives in memory and
re-renders drive the UI. Here, the **database is the state** — every
request opens a session, reads/writes rows, and closes it. Nothing
persists in memory between requests.

### From SQLite to PostgreSQL

The project started on SQLite (a single `app.db` file) and now runs on a
PostgreSQL server. What actually changed, nearly all of it in
`backend/app/core/database.py`:

- **The URL.** `sqlite:///./app.db` became
  `postgresql+psycopg2://vram:vram@localhost:5432/vram_admin` —
  `user:password@host:port/database`. The `+psycopg2` part names the
  driver, which is why `psycopg2-binary` is in `requirements.txt`.
- **Connection pooling starts mattering.** `pool_pre_ping=True` and
  `pool_recycle=3600` replaced SQLite's `check_same_thread` argument. A
  file cannot hang up on you; a database *server* can (idle timeout,
  restart), so the pool tests a connection before reusing it and retires
  any older than an hour.
- **Foreign keys are enforced for free.** SQLite ignored FK constraints
  unless `PRAGMA foreign_keys=ON` ran on every new connection, so there
  was an event listener doing exactly that. It is gone — Postgres
  enforces them itself.
- **No more `create_all()` at startup.** `main.py` used to build missing
  tables on every boot; it does not now, so a fresh database needs
  `alembic upgrade head` before the app can serve a request.
- **One connection string, not two.** `alembic.ini` no longer holds a
  `sqlalchemy.url`; `alembic/env.py` imports `DATABASE_URL` from
  `database.py` and sets it at runtime, so the app and its migrations
  cannot drift onto different databases.

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
| `GET /admin_sidebar` | any logged-in user (no role filter yet) | `sidebar.py` |
| `GET /admin/users` | role id `1` only | `admin.py` |
| `GET /editor/content` | role id `1` only (no separate editor role yet) | `editor.py` |
| `GET\|POST /{module_path}…` | any logged-in user, no role check | `dynamic.py` (§8) |

The last row is three *catch-all* routes rather than one endpoint, and
they must be registered **last** in `routers.py`: `"/{module_path}"`
matches any single-segment path, and FastAPI/Starlette takes the first
route that matches in declaration order, so anything added below it would
never be reached.

`CORSMiddleware` is required because browsers block a page on
`localhost:5173` (React) from calling `localhost:8000` (Python)
without the server explicitly allowing it — a browser security rule,
not a Python one.

## 8. Dynamic modules (`backend/app/modules/`)

The biggest idea in the project, and the reason §4b spends so long on
decorators. **The problem it solves:** every admin table needs the same
five things — a list, search, sort, pagination, and create/edit/delete.
Hand-writing a route, a schema, and a React page per table means the
tenth table costs as much as the first.

**The solution:** describe the table instead of coding it.

```python
@controller("RolesController")
class RolesController(ModuleController):
    table_name = "adm_roles"
    search_columns = ["name"]
    table_fields = {"id": {"label": "ID"}, "name": {"label": "Role"}}
    form_fields = {"name": {"label": "Role", "required": True, "max": 255}}
```

That is the entire Roles module. No route, no Pydantic schema, no query,
no React file. `GET /roles` already returns a searchable, sortable,
paginated list, because `ModuleController` (in `helpers/generated_module.py`) supplies
`get_index`, `post_store`, `post_update`, and `post_delete`, and
**inheritance** hands all four to every subclass. This is the Python port
of the Laravel template's `GeneratedModuleController.php` — the port is
compared line for line in [docs/MODULES.md](docs/MODULES.md#laravel-comparison).

### How a URL becomes a method call

There are only three routes in `api/dynamic.py`, and they cover every
module that will ever exist:

```
GET  /roles                -> RolesController.get_index()
GET  /users/edit/7         -> UsersController.get_edit("7")
POST /users/bulk-action    -> UsersController.post_bulk_action()
```

The rule is mechanical: lowercase the HTTP verb, add `_index` if there is
no action segment, otherwise add the action with hyphens turned into
underscores. Two lookups happen in between — the URL's first segment
finds a row in `adm_modules`, and that row's `controller` string finds a
class.

### Why a plain dict is a security feature

```python
CONTROLLERS: dict[str, type] = {}
```

Someone with database access can type anything into
`adm_modules.controller`. This dict is the only way that string becomes a
class, so a name nobody registered can never be reached — no matter what
is in the row. Same idea one level down: `@action` marks which *methods*
a URL may call, because Python has no `public` keyword and a bare
`getattr(instance, name_from_url)` would otherwise reach any attribute on
the object.

That pattern — **an allowlist you can only add to from code** — shows up
seven times in this system (path shape, active flag, controller name,
action marker, table name, argument count, and which columns may be
sorted/filtered/searched). All seven are tabulated in
[docs/MODULES.md](docs/MODULES.md#where-the-trust-boundaries-are).

### The filesystem is the registry

There used to be one hand-written import line per controller, because
importing a file is what runs its `@controller` decorator and Python has no
autoloader. That list carried no information, and forgetting a line returned
`500 unregistered controller` while the class sat right there.

`registry.discover()` replaces it — `pkgutil.iter_modules()` is the glob,
`importlib.import_module()` is the autoload. That is what Laravel gets free
from PSR-4: `routes/web.php` filters `adm_modules` rows through
`glob('Controllers/Admin/*.php')` and resolves the class by name. Drop a
file in `modules/admin/` and it is registered.

It is a function called from `api/dynamic.py`, not a loop in the package's
`__init__`, and that matters: scanning at package-import time would make
`from app.modules.registry import action` drag in every controller as a side
effect — and controllers import the base class, which imports the registry,
so importing the base class first was a circular import.

### And you do not have to write the controller either

`generate()` in `app/modules/admin/module_generator.py` introspects the table
and writes the file, the way the Laravel template's Modules screen does. It has
no CLI wrapper — the admin screen is where it gets called from. See
[docs/MODULES.md](docs/MODULES.md#adding-a-module).

### What is not finished

Worth knowing: the `POST` actions used to crash, because the three route
handlers passed the request body without `await` — a coroutine, not a
dict. Fixed on 2026-08-31, and create/edit/delete now work end to end
from the UI. What is still open is per-role permissions on module routes:
a valid token is enough. See
[docs/MODULES.md](docs/MODULES.md#known-gaps).

## 9. Frontend structure

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
- **`Sidebar.jsx`** — fetches `GET /admin_sidebar` on mount and renders
  every row it gets back under the "Admin" heading (see
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)'s "Sidebar and menus").
  No hardcoded link list anymore, except `Dashboard` itself. The
  `userMenus` group is still in the component but hardcoded empty, left
  for when non-admin menus get their own source.
- **`Dashboard.jsx`** — reads `user.role_id` and conditionally renders
  cards, and separately calls `/admin/users`, which the *backend*
  rejects for non-superadmins regardless of what the frontend shows.

### The module pages

The frontend mirror of §8. One route in `App.jsx` serves every module:

- **`App.jsx`** has one `"/:modulePath/*"` splat route alongside
  `"/dashboard"`, both inside a pathless layout route that declares the
  auth guard and the shell once. React Router v6 ranks routes by
  **specificity, not declaration order**, so the static `/dashboard`
  always wins — the exact opposite of the backend, where declaration order
  is everything. The file does not grow when you add a page.
- **`ModuleRoute.jsx`** splits the splat into `modulePath` / `action` /
  `args`, resolves the page most-specific-first, and renders either the
  custom page or the shared runtime. `key` forces a remount so you never
  see the previous module's rows under the new module's heading.
- **`modulePages.js`** is an `import.meta.glob` over `pages/modules/**`:
  the filesystem is the registry, so a page is registered by being
  created. A module with no file still works.
- **`GeneratedModulePage.jsx`** is the shared runtime: it renders
  whatever `columns` / `rows` / `pagination` the backend sent, so it
  already works for a module that does not exist yet. **Don't edit it for
  one module.**
- **`modules/roles/index.jsx`** is what "custom" looks like — a single
  `renderCell` prop that draws `is_superadmin` as a badge and
  `theme_color` as a colour swatch. Everything else is inherited.
- **`NavbarContext.jsx`** and **`components/sidebar/AdminSidebar.jsx`**
  are scaffolding, not features: the first holds a `title` state with its
  `useEffect` commented out and nothing providing it, the second is an
  empty file.

The trap to remember: `Sidebar.jsx` builds its link from the `slug`
column in `adm_admin_menuses`, but the backend finds the module by the
`path` column in `adm_modules`. Nothing checks that those two agree, so a
typo gives you a sidebar link that 404s while both rows look fine.

### Styling and the role theme

Two styling systems live in `src/index.css`, on purpose:

- **Hand-written semantic CSS** — `.card`, `.sidebar-link`,
  `.module-table`. This is what every component uses today.
- **Tailwind v4** — added 2026-08-31 for new work. No
  `tailwind.config.js` and no `postcss.config.js`: v4 is configured by an
  `@theme` block inside the CSS, with `@tailwindcss/vite` in
  `vite.config.js`.

The trick that makes them agree is that every Tailwind colour token points
at one of the project's own custom properties:

```css
@theme static { --color-skin-accent: var(--accent); }
```

so `bg-skin-accent` resolves to `var(--accent)` — the same variable the
theme changes at runtime. One palette, two ways to spell it.

**The thing that will bite you:** Tailwind's utilities live in
`@layer utilities`, and CSS says *unlayered rules beat every layer*. The
project's own CSS is unlayered, so `<button className="bg-skin-panel">`
will **not** override the existing `button { background: var(--accent) }`.
Utilities work fine on `div`s and new components; they lose wherever the
old stylesheet already targets the same element and property.

**The theme itself** comes from `adm_roles.theme_color`, which reaches the
browser through `GET /me` → `AuthContext` → the `Themed` bridge in
`App.jsx` → `ThemeProvider`. `config/themeOptions.js` then decides what to
do with the value: a skin name like `skin-blue` stamps
`data-app-theme="blue"` on `<html>` and a palette in `index.css` takes
over; a raw hex like `#93701A` sets `--accent` inline instead. Both spellings
exist in the codebase, which is why the file accepts either.

Only one role exists today and its `theme_color` is null, so this is built
but unexercised — set the column to `skin-blue` and reload to watch it work.

## 10. Running it

```bash
# Backend  (PostgreSQL must already be running — see below)
cd backend
venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head    # creates every table; nothing does this at startup
python seed.py          # creates roles + admin@vram.com / admin123
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The database itself is not created for you: you need a PostgreSQL server
with a `vram_admin` database and a `vram` login before any of the backend
commands work — [docs/DATABASE.md](docs/DATABASE.md) walks through it
start to finish. A `connection refused` or
`database "vram_admin" does not exist` error means that setup was
skipped, not that the Python is wrong.

Visit `http://localhost:5173`, log in with `admin@vram.com` / `admin123`.
Register a second user via the `/register` endpoint (e.g. through the
FastAPI docs at `http://localhost:8000/docs`) — it's created with no
role (`id_adm_role` is `null`), so logging in as them shows the locked
cards, since none of the role-id checks match.

## 11. Where to go next

Fix first — these are known-broken or known-open, not ideas:

- **Put a role check on the module routes.** Right now any logged-in user
  can read every row of every module's table.
- **Validate the `slug` / `path` pairing** between `adm_admin_menuses`
  and `adm_modules`, or read the sidebar link from `adm_modules` instead.
- **Seed the module and menu rows.** Nothing creates them — not
  `seed.py`, not a migration — so a freshly migrated database has an
  empty sidebar and no modules, and the existing `roles` rows were
  inserted by hand. Adding them to `seed.py` makes the project
  reproducible from scratch.

Then build:

- A create/edit form in `GeneratedModulePage` — the backend already sends
  `formFields` and the browser currently ignores it.
- A real Users module to replace the `users_module.py` stub, using
  `before_store()` to hash the password.
- Nest the sidebar by `parent_id` — the column is returned and unused.
- Add a "create user" form in the frontend (admin-only) that calls `POST /register`.
- Add refresh tokens (current JWT expires after 60 minutes, hardcoded in `auth.py`).
- Move `SECRET_KEY` out of the code and into an environment variable.
- Move `DATABASE_URL` out of `database.py` as well — the Postgres
  password is sitting in source in plain text, and `alembic/env.py`
  imports it from there, so it is a one-place change.
- Write the first test. There is no test harness at all yet.

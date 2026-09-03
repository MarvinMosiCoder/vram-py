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

## Coming from Laravel

This project is a port of a Laravel + Inertia admin template of the same
name, and several files say so in their own comments. The single
difference that explains most of the others: Laravel is one process that
renders a page and its props together and authenticates with a session
cookie, while this is two servers exchanging JSON with a bearer JWT — so
there are no shared props, no CSRF token, and CORS has to be configured
explicitly. [LARAVEL.md](LARAVEL.md) maps the whole stack concept by
concept, and [MODULES.md](MODULES.md) covers the port of
`GeneratedModuleController.php`, which is the largest single piece.

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
      role.py                    Role                 -> adm_roles
      user.py                    User                 -> adm_users
      module.py                  Modules              -> adm_modules
      menus.py                   Menuses              -> adm_menuses
      adm_roles_privileges.py    AdminRolesPrivileges -> adm_roles_privileges
      __init__.py        re-exports all five (see "Models and schemas" below)
    schemas/           Pydantic request/response shapes, mirroring models/
      user.py                    UserCreate, UserLogin, UserOut
      token.py                   Token
      module.py                  ModuleOut
      menus.py                   MenuOut
      adm_roles_privileges.py    AdminRolesPrivileges
      __init__.py        re-exports all of the above
    modules/           the dynamic module system (see "Dynamic modules")
      registry.py        CONTROLLERS dict + the @controller / @action decorators
      base.py            ModuleController — the shared, inherited CRUD surface
      roles_module.py    RolesController -> adm_roles (metadata + the
                          permissions-matrix escalation, see MODULES.md)
      users_module.py    UsersController -> adm_users — a real module now: a
                          role_name join, an id_adm_role FK-select, bulk actions
      __init__.py        imports every module file; the import IS the registration
    api/
      routers.py       combines every feature router below — the only
                        file main.py imports; adding a new feature area
                        means adding a router here, not touching main.py
      serializers.py   User -> UserOut, shared by auth.py and admin.py
      auth.py          /register, /login, /logout, /me
      dashboard.py     /dashboard
      sidebar.py       /admin_sidebar (adm_modules), /user_sidebar (adm_menuses,
                        role-scoped)
      admin.py         /admin/users
      editor.py        /editor/content
      dynamic.py       the three catch-all module routes — MUST be the last
                        router included, see "Dynamic modules" below
  alembic/             migration environment + versions/ (see MIGRATIONS.md)
  alembic.ini          alembic config — deliberately has no sqlalchemy.url;
                        env.py injects it from core/database.py
    seeders/           one file per seeder; the import IS the registration
      base.py            Seeder — order, idempotency contract, run(db); a
                          seeder picks skip-if-exists or upsert-if-exists per row
      registry.py        SEEDERS dict + the @seeder decorator + discover()
      roles_seeder.py    adm_roles
      admin_user_seeder.py     adm_users (admin@vram.com)
      modules_seeder.py        adm_modules — upserts, so an edited MODULES
                                entry is pushed on every run, not just inserted once
  seed.py              the seeder runner: `python seed.py [--list|<Name>…]`

frontend/
  vite.config.js           React plugin + the Tailwind v4 plugin
  src/
    index.css              the whole stylesheet: Tailwind import, @theme
                            tokens, role palettes, then semantic classes
    api.js                 shared axios instance + auth-header interceptor
    context/AuthContext.jsx  global auth state (user, login, logout)
    context/NavbarContext.jsx  scaffolding — a title state whose effect is
                                commented out; nothing provides or reads it yet
    context/ThemeContext.jsx   applies the signed-in user's role theme to
                                <html>; also carries a profile context
    config/themeOptions.js     resolves adm_roles.theme_color to a palette
                                (skin name or raw hex) — see "Styling" below
    components/         grouped by category; folders lowercase, files PascalCase
      auth/ProtectedRoute.jsx    route guard (auth + role check)
      button/                    PrimaryButton, SecondaryButton, DangerButton
      form/                      InputLabel, TextInput, Checkbox, SelectInput,
                                  InputError
      panel/                     TopPanel (page header strip), ContentPanel
                                  (the card), Toast
      toast/DissapearingToast.jsx  rendered once by ToastProvider
      sidebar/UserSidebar.jsx    fetches GET /user_sidebar, renders "Menu"
      sidebar/AdminSidebar.jsx   fetches GET /admin_sidebar, renders "Admin
                                  Menu" (only when user.is_superadmin) —
                                  used to be an empty placeholder file
      sidebar/SidebarMenuCard.jsx          single link, active-state aware
      sidebar/SidebarMenuCardMultiple.jsx  expandable group, auto-opens on
                                            an active child route
      table/                     Table, TableHead, TableBody, TableRow,
                                  HeadData (<th>), RowData (<td>),
                                  RowActions (cluster), RowAction (icon button)
    context/SidebarContext.jsx  open/closed state, read+driven by both
                                 AppSidebar.jsx and AppNavbar.jsx's toggle button
    layout/Layout.jsx       the shell: AppNavbar / AppSidebar / AppContent / AppFooter
    layout/AppNavbar.jsx    full-width top bar, plus the mobile sidebar toggle
    layout/AppSidebar.jsx   composes UserSidebar.jsx + AdminSidebar.jsx; fixed
                             overlay below md, width-collapsing column at md+
    layout/AppContent.jsx   breadcrumbs + the scrolling region + ToastProvider
    layout/AppFooter.jsx    copyright strip
    pages/Login.jsx
    pages/Dashboard.jsx
    pages/ModuleRoute.jsx   sits behind "/:modulePath/*", splits the splat into
                             module / action / args, picks the page component
    pages/modulePages.js    import.meta.glob over pages/modules/** -- the
                             filesystem is the page registry, nothing is listed
    pages/modules/roles/index.jsx          the Roles module's wrapper page
    pages/modules/roles/edit-permissions.jsx
                            /roles/edit-permissions/<id>, claimed by filename
    pages/modules/users/add.jsx, edit.jsx, user-form.jsx
                            /users/add, /users/edit/<id> — reachable only once
                            UsersController sets use_add_route/use_edit_route
    pages/admvram/vramjsx/GeneratedModulePage.jsx
                            the shared module runtime — renders whatever
                             metadata render_index() sends; not per-module
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

A request whose path matches no static route takes one extra hop instead
of 404ing, because the last router mounted is a catch-all:

```
core/middleware.py (RequireAuthMiddleware)      — same as above
api/dynamic.py (module_index / module_action / module_action_args)
  -> Depends(auth.get_current_user) + Depends(database.get_db)  — same as above
  -> MODULE_PATH_RE guards the path shape
  -> adm_modules row (path, is_active=1) -> its `controller` string
  -> CONTROLLERS[...] -> a ModuleController subclass  [modules/registry.py]
  -> getattr(instance, "get_index") if marked @action  [helpers/generated_module.py]
  -> SQLAlchemy Core select() against Base.metadata.tables[table_name]
  -> render_index() returns a plain dict — no Pydantic schema here
```

Two things are different on this path. There is no `response_model`: the
shape is whatever `render_index()` builds, because the columns are not
known until runtime. And the query is written in SQLAlchemy's 2.0
`select()` style rather than the `db.query(...)` style the static routes
use — both work against the same session, they are simply two eras of the
same library.

**`dynamic.router` must be the last router included in `routers.py`.**
`"/{module_path}"` matches any single-segment path, and Starlette
resolves first-match-wins in declaration order, so anything included
below it would be shadowed — `/dashboard` would be looked up as a module
named `dashboard`. The frontend has the same catch-all but the opposite
rule: React Router v6 ranks by specificity, so `"/dashboard"` beats
`"/:modulePath"` in `App.jsx` regardless of order.

`RequireAuthMiddleware` and each route's `Depends(auth.get_current_user)`
both call the same `auth.get_user_from_token()` — the middleware is a
fail-closed backstop (a route added without an explicit `Depends` is
still protected), the per-route dependency is what actually hands the
`User` object to the route body.

`GET /admin_sidebar` is the case that proves the backstop earns its keep:
`api/sidebar.py` takes only `Depends(get_db)` and no auth dependency at
all, so the middleware is the *only* thing authenticating it. It works,
and it is worth knowing about — the route body has no `User` to read, so
per-user or per-role behaviour there needs the dependency added first.

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
can serve a request. `seed.py` used to call `create_all()` too, which was
the one remaining way to race alembic; it now checks the tables exist and
points you at `alembic upgrade head` instead, so migrations are the only
thing that touches schema. See [MIGRATIONS.md](MIGRATIONS.md).

## Models and schemas

Both packages are **one file per area**, named after the thing they
describe, with the package `__init__.py` re-exporting everything:

| | |
|---|---|
| `models/role.py`, `user.py`, `module.py`, `menus.py`, `adm_roles_privileges.py` | one SQLAlchemy table each |
| `schemas/user.py`, `token.py`, `module.py`, `menus.py`, `adm_roles_privileges.py` | the Pydantic shapes for that area |

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
`is_superadmin = 1`) — by `RolesSeeder`. The model supports more
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
| `GET /admin_sidebar` | any authenticated user — no role filter, see [api/sidebar.md](api/sidebar.md) | `RequireAuthMiddleware` **only** |
| `GET /admin/users` | role id `1` | `require_role(1)` |
| `GET /editor/content` | role id `1` (temporary — no editor role exists yet) | `require_role(1)` |
| `GET\|POST /{module_path}[/{action}[/…]]` | any authenticated user — **no role filter**, see [MODULES.md](MODULES.md) | `get_current_user` |

The last row is the widest hole in the table and worth stating plainly:
every dynamic module route is reachable by any logged-in user. A module's
`actions` flags decide whether create/edit/delete *exist*, not who may
call them, and `require()` in `helpers/generated_module.py` says as much in its own
docstring. Closing it means either `Depends(auth.require_role(...))` on
the dynamic router or a role consulted inside `require()`.

See [API.md](API.md) for full request/response details on each route.

## Sidebar and menus

Two tables, two routes, two different access models — deliberately, not
as an in-progress state. `adm_admin_menuses`, the table this section used
to describe as "added 2026-08-30," was reverted the same cycle it was
introduced: `AdminMenu`, `AdminMenuses`, its migration and its seeder are
all gone, and `/admin_sidebar` was repointed at `adm_modules` instead.

- **`adm_modules`** — a registerable feature area: `name`, `icon`,
  `path`, `table_name`, `controller`, `is_active`, and `is_protected`.
  `is_protected` does **not** mean "requires a role" — it marks a
  built-in admin module (Roles, Users Management, ...) as opposed to a
  future user-generated one. Read by `api/dynamic.py` to resolve every
  module request (see "Dynamic modules" below) **and** by
  `GET /admin_sidebar`, filtered to `is_active = 1 AND is_protected = 1`.
  Access here is a flat flag: every authenticated caller sees the same
  admin-module list, no per-role filtering.
- **`adm_menuses`** — one sidebar entry: `name`, `type`, `path`, `slug`,
  `icon`, `color`, `sorting`, `is_dashboard`, `parent_id` (FK ->
  **`adm_menuses.id`**), and `id_adm_role` (FK -> `adm_roles.id`). Read by
  the newer `GET /user_sidebar`. Access here is per-row: each menu
  belongs to exactly one role, no join table — unlike `adm_modules`'
  many-role privilege flags in `roles_module.py`'s `AdminRolesPrivileges`
  join.

**A menu's parent is another menu, not a module.** `adm_menuses` used to
carry `patent_id`, a typo'd FK into `adm_modules.id`. Migration
`253f97ec1dfd` renamed it to `parent_id` and re-pointed the FK at
`adm_menuses.id`, so `NULL` means top level and any other value names the
accordion group the entry sits under.

`GET /admin_sidebar` (`api/sidebar.py`) reads `adm_modules`, keeps
`is_active = 1` and `is_protected = 1`, orders by `id`, and returns a
flat list of `schemas.ModuleOut`. `GET /user_sidebar` reads `adm_menuses`
instead: top-level rows (`parent_id IS NULL`) filtered to the caller's
own `id_adm_role`, `is_active = 1`, `is_dashboard = 0`, and for each one a
second query for its own children (`parent_id = <that row's id>`, same
filters) — one level deep, matching Laravel's
`CommonHelpers::sidebarMenu()`. Both routes share one `APIRouter` in
`sidebar.py`; only `/user_sidebar` takes a `current_user` dependency,
since only it needs a role to filter by. See
[api/sidebar.md](api/sidebar.md) for the full response shapes.

`AppSidebar.jsx` composes `UserSidebar.jsx` (fetches `/user_sidebar`) and
`AdminSidebar.jsx` (fetches `/admin_sidebar`, rendered only when
`user.is_superadmin`), each mapping its rows through `SidebarMenuCard.jsx`
(a single link) or `SidebarMenuCardMultiple.jsx` (an expandable group,
auto-opening when a child route is active) depending on whether a menu
row has children. `SidebarContext.jsx` holds the open/closed state both
`AppSidebar.jsx` and the hamburger button in `AppNavbar.jsx` read and
drive — a fixed overlay below the `md` breakpoint, a width-collapsing
column at `md` and up. `Dashboard` is still a separate hardcoded link
with no row in any table, since every signed-in user always sees it.

## Dynamic modules

The newest and largest piece of the project, and the one that changes how
you add a feature. A row in `adm_modules` names a controller class; that
class declares its columns as metadata; and a searchable, sortable,
paginated `GET /<path>` exists with no new route, no Pydantic schema, and
no React file. `adm_roles` is served this way today, through
`RolesController`, which is forty lines of pure declaration.

```mermaid
flowchart LR
    R[("adm_modules row<br/>path · table_name · controller")] --> D["api/dynamic.py<br/>3 catch-all routes"]
    D --> C{"CONTROLLERS<br/>registry.py"}
    C --> M["ModuleController subclass<br/>helpers/generated_module.py"]
    M --> T[("Base.metadata.tables<br/>[table_name]")]
    M --> P["render_index() props"]
    P --> G["GeneratedModulePage.jsx<br/>shared React runtime"]
    G -.->|"custom page, optional"| W["modulePages.js glob<br/>modules/roles/index.jsx"]
```

The design splits *what exists* from *what is possible*, and as of
2026-09-01 the line sits further over than it used to. The database half
now carries a module's whole field configuration — `table_fields`,
`form_fields`, `search_columns`, `actions` and the scalars beside them —
so a row whose `controller` is empty is a complete, working module with no
Python file behind it. `DataDrivenModuleController` reads it.

The code half is still not admin-editable: `registry.discover()` scanning
`modules/admin/` is the only way a controller string resolves to a class,
`Base.metadata.tables[...]` is the only way a `table_name` resolves to a
table, and `NEVER_EXPOSE` is the only thing that decides whether a column
may be surfaced at all. So an admin can now introduce a *module* from the
database, but still not new *behaviour*, not an undeclared table, and not a
password hash.

Eight allowlists sit on that boundary — the path regex, the `is_active`
filter, the `CONTROLLERS` dict (now filesystem-derived, same property), the
`@action` marker (Python has no `public` keyword, so reachability has to be
opt-in per method), the metadata table lookup, the signature arity check,
the declared-column allowlists behind `?sort_by=`, `?search=` and
`?<column>=`, and the `NEVER_EXPOSE` denylist that the declared columns are
themselves filtered through. Each is listed with what it blocks in
[MODULES.md](MODULES.md).

Two limits matter for the security model in this document. **Module
routes have no role check**: `Depends(auth.get_current_user)` means any
valid token, and a module's `actions` dict gates capability rather than
identity — it is the same for every caller. Write actions **now work**: until 2026-08-31
the three handlers passed an un-awaited coroutine as the request body, so
every `POST` raised before touching the database; they `await` it now, and
store/update/delete are verified against the running API. The role-check
gap is written up under [MODULES.md](MODULES.md#known-gaps).

Full reference — the controller contract, the hooks, the response shape,
how to add a module, and the Laravel mapping — is in
[MODULES.md](MODULES.md); the route and error reference is in
[api/modules.md](api/modules.md).

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
- **`UserSidebar`/`AdminSidebar`** each fetch their own route
  (`/user_sidebar`, `/admin_sidebar`) on mount — see "Sidebar and menus"
  above. Both refetch only on mount, so a menu/role change elsewhere
  requires a page reload to show up, same caveat as `AuthContext`'s
  `user`.
- **`SidebarContext`** holds one boolean, `isSidebarOpen`, read and
  written by `AppSidebar.jsx` (the panel itself, and the mobile
  auto-close/open on a `matchMedia` resize listener) and `AppNavbar.jsx`
  (the hamburger toggle button).
- **`GeneratedModulePage`** holds its own local state per module — rows,
  pagination, search term, sort column and direction — and refetches
  whenever any of them changes. Nothing about a module lives in a
  context, so two module pages never share state; `ModuleRoute`'s
  `key={modulePath}` deliberately throws the state away on navigation
  rather than letting stale rows show under a new heading.
- **`ThemeContext`** provides two contexts from one provider: `useTheme()`
  for the resolved skin name and `useProfile()` for the user object it was
  handed. It is wired in `App.jsx` via the `Themed` bridge and applies the
  theme by stamping `<html>` — see "Styling and theming" below. Nothing
  currently *consumes* either hook; the visible effect comes entirely from
  the attributes it sets on the document element.
- **`NavbarContext`** exists but is inert: it holds a `title` state whose
  `useEffect` is commented out, and no component provides or consumes it
  yet. It is scaffolding for a per-page title, not a working feature.
  `components/sidebar/AdminSidebar.jsx` used to be the same kind of
  placeholder — it now fetches `GET /admin_sidebar` and renders through
  `SidebarMenuCard.jsx`, same as its `UserSidebar.jsx` sibling.
  `components/table/RowActions.jsx` is a working component that nothing
  renders yet.

A note on the sidebar-to-module link, since it crosses the whole stack:
`AdminSidebar.jsx` links each row by its `path` in `adm_modules` — the
same column `api/dynamic.py` resolves a module by, so a module reachable
by URL is reachable from the sidebar by construction, no separate table
to drift out of sync with. `UserSidebar.jsx` is looser by necessity: a
menu row's `path`/`slug` in `adm_menuses` isn't tied to any
`adm_modules` row at all (a menu can point anywhere), so nothing
validates that a menu's link actually resolves to something — a typo
there is still a link that 404s with the row looking correct, just one
level removed from the module system rather than two tables disagreeing
with each other.

## Styling and theming

Two systems, deliberately coexisting: **hand-written semantic CSS** (the
original, and still what every component uses) and **Tailwind v4** (added
2026-08-31, for new work). Everything lives in one file,
`frontend/src/index.css`, in this order:

```
@import "tailwindcss";      Tailwind's preflight + utilities
@theme static { ... }       Tailwind tokens, each pointing at a --var below
:root { ... }               the project's own palette
:root[data-app-theme="…"]   one block per role theme
:root.app-theme-dark        the one skin that also swaps page surfaces
.sidebar-link, .card, …     the semantic classes components actually use
```

Tailwind v4 needs no `tailwind.config.js` and no `postcss.config.js` —
`@tailwindcss/vite` in `vite.config.js` plus the `@theme` block above is
the whole configuration.

**One palette, two consumers.** Every `@theme` token is defined as
`var(--…)` pointing at the project's own property:

```css
@theme static { --color-skin-accent: var(--accent); }
```

So `bg-skin-accent` compiles to
`background-color: var(--color-skin-accent)` → `var(--accent)`, which means
a utility class picks up the signed-in user's role theme at runtime, the
same way `.sidebar-link.active` does. `static` is required: without it
Tailwind tree-shakes tokens no utility references, leaving
`var(--color-skin-*)` undefined for hand-written rules.

**The cascade gotcha, worth knowing before you reach for a utility.**
Tailwind puts preflight and utilities inside `@layer base` / `@layer
utilities`; the project's own CSS is *unlayered*, and unlayered rules beat
every cascade layer regardless of order or specificity. Two consequences:

| | |
|---|---|
| Good | Tailwind's preflight cannot disturb the existing look. The bare-element rules (`button`, `input`, `h1`, `label`) still win, so nothing had to change when Tailwind went in. |
| Bad | A utility **loses** to an existing rule for the same property. `<button className="bg-skin-panel">` will not override `button { background: var(--accent) }`. Utilities are safe on elements the stylesheet doesn't already target, and on properties it doesn't already set. |

The clean fix, when it matters, is to move those bare-element rules onto
classes; until then, prefer utilities for layout and spacing on `div`s and
new components, which is where nothing collides.

### The component family

`GeneratedModulePage` composes components rather than writing raw markup.
The set is modelled on the Laravel project's own (`resources/js/Components/`
at `C:/laragon/www/vram`), which is a **custom set, not Laravel Breeze** —
worth stating because the Breeze names (`PrimaryButton`, `TextInput`,
`InputLabel`) were an early wrong guess here and some still remain.

Folders are lowercase, files PascalCase, matching the rest of the tree
(`config/`, `context/`, `layout/`, `pages/`):

| Group | Here | In the Laravel project |
|---|---|---|
| `table/` | `TableContainer`, `Table`, `TableHead`, `TableBody`, `TableRow`, `HeadData`, `RowData`, `RowActions`, `RowAction`, `BreadCrumbs` | `TableContainer`, `Thead`, `Tbody`, `Row`, `TableHeader`, `RowData`, `RowActions`, `RowAction`, `BreadCrumbs` — plus `Pagination`, `PerPage`, `TableSearch`, `RowStatus`, `Tabs`, `Buttons/`, `Icons/` |
| `panel/` | `TopPanel`, `ContentPanel`, `Toast` | `ContentPanel` and `TopPanel` live under `Components/Table/` there, not a `Panel/` folder |
| `toast/` | `DissapearingToast` | `Components/Toast/DissapearingToast` — same name, spelling included |
| `button/` | `PrimaryButton`, `SecondaryButton`, `DangerButton` | `Table/Buttons/Button`, `Buttonv2`, `TableButton`, `BulkActions`, `Export`, `Import`, `Filters` |
| `form/` | `InputLabel`, `TextInput`, `Checkbox`, `SelectInput`, `InputError` | `Forms/Input`, `Select`, `TextArea`, `InputFile`, `InputPassword`, `Card`; `Checkbox/Checkbox` |
| `auth/` | `ProtectedRoute` | no equivalent — Inertia has server-side middleware instead |

So the table primitives still need renaming to `Thead` / `Tbody` / `Row` /
`TableHeader`, and the panels moving under `table/`, to line up fully. The
naming is the only difference; the composition already matches.

Two components encode a hard-won detail. `RowData`'s `center` prop used to
apply only Tailwind's `text-center`, which loses to the unlayered
`.module-table td` rule — it now emits `is-center` as well. And `RowAction`
maps a descriptor's icon name (`"pencil"`, `"trash"`) onto its own action
keys, so a module's `actions` metadata can choose the glyph.

### The app shell

`layout/` mirrors the Laravel project's `Layouts/layout/` region by region:

```
Layout                        (layout.jsx there)
  NavbarProvider              mounted here, not in App.jsx — the title
                               belongs to the authenticated shell
    AppNavbar                 full width, above the sidebar
    AppSidebar                below the navbar, on the left
    main
      AppContent              the ONLY scrolling region; owns breadcrumbs
                               and mounts ToastProvider
      AppFooter               pinned beneath it
```

That is a change from the previous shell, where the sidebar ran full height
and the top bar sat inside the right-hand column.

`AppContent` keeps its `id="app-content"` for a specific reason:
`ToastContext.handleToast()` calls
`document.getElementById("app-content").scrollIntoView(true)`, so a toast
raised from halfway down a long table is actually seen.

`ToastContext` is ported with its exact contract — the context value is an
**object** `{ message, messageType, handleToast }` and `handleToast` takes
`(message, messageType, duration = 3000, ...callbacks)`. Returning a bare
function would break every caller ported across. `useToast()` throws outside
a provider, as the original does; `useOptionalToast()` is an addition, for
`GeneratedModulePage`, which must also work in a wrapper page rendered
outside the shell.

### The theme pipeline

`config/themeOptions.js` is a **verbatim port** of the Laravel project's
`resources/js/Config/themeOptions.js` (at `C:/laragon/www/vram`), because
four consumers compare against its exact return values —
`ThemeContext`, `AppContent`, `AppFooter` and `RowData`. Getting the
spelling wrong there fails silently rather than loudly.

| Export | Returns |
|---|---|
| `SYSTEM_THEME_ID` | `"system"` — the "follow the system theme" sentinel |
| `legacyThemeOptions` | the 13 AdminLTE skins, `{ id, name, hex }` — `skin-blue` … `skin-white` |
| `dashboardThemeOptions` | 17 `skin-palette-*` entries for chart and card colours |
| `personalThemeOptions` | white + black + the dashboard palette, for a theme chooser |
| `isCustomThemeColor(v)` | true only for a **6-digit** hex (`#134B70`); `#abc` is *not* custom |
| `normalizeThemePreference(v)` | the value if supported, else `"system"` |
| `resolveThemeColor(v, systemTheme)` | a full skin id (`"skin-blue"`), **not** a short name |
| `getThemeClass(v)` | `"bg-skin-custom"` for a hex, else `` `bg-${resolvedTheme}` `` |
| `getThemeHex(v)` | the hex for a skin id or class, or the hex itself |
| `isDashboardPaletteTheme(v)` | whether it is one of the `skin-palette-*` entries |
| `applyThemeColor(v)` | writes eight `--app-theme-*` custom properties on `<html>` |

`applyThemeColor` is where the work happens. It uses the standard **YIQ
perceptual brightness** formula to pick a readable foreground, then derives
the rest of the palette from one hex:

| Property | Purpose |
|---|---|
| `--app-theme-color` | the accent itself |
| `--app-theme-contrast` | `#111827` or `#FFFFFF`, whichever is readable on it |
| `--app-theme-readable` | darkened to 62% when the accent is light, for hover/active |
| `--app-theme-light` | lightened 50% toward white |
| `--app-theme-soft` / `-soft-strong` / `-border` / `-deep` | translucent variants at 10% / 18% / 34% / 28% |

`index.css` aliases the project's own names onto those —
`--accent: var(--app-theme-color)`, `--accent-dim:
var(--app-theme-readable)`, `--accent-soft: var(--app-theme-soft-strong)` —
so every existing rule keeps working and a theme change moves both sets at
once. The literal fallbacks on `:root` are the original green, used before
any theme has been applied.

```mermaid
flowchart LR
    R[("adm_roles.theme_color")] --> M["GET /me → UserOut.theme_color"]
    M --> A["AuthContext user"]
    A --> T["Themed bridge in App.jsx"]
    T --> P["ThemeProvider (ThemeContext.jsx)"]
    P --> O["config/themeOptions.js"]
    O -->|"applyThemeColor"| V["8 × --app-theme-* on html"]
    O -->|"getThemeClass"| C["theme = 'bg-skin-blue'"]
    C -->|"=== 'bg-skin-black'"| K["html.app-theme-dark<br/>swaps page surfaces"]
    C --> D["RowData / AppContent / AppFooter<br/>dark-mode checks"]
```

Only `skin-black` swaps the page *surfaces* (via `.app-theme-dark`); every
other skin is an accent change. That is why there is no longer a CSS block
per skin — the hex table in `themeOptions.js` is the single source.

`ThemeProvider` needs a user, and the user only exists inside
`AuthProvider`, so `App.jsx` has a small `Themed` bridge that reads
`useAuth()` and passes `user?.theme_color` down. Before login that is
`undefined`, which normalises to `"system"` and resolves to `skin-blue`.

Two caveats. Only one role exists today and its `theme_color` is null, so
the machinery is unexercised — set the column to `skin-blue`,
`skin-palette-teal` or `#134B70` to see all three paths. And
`applyThemeColor` never *clears* the properties it sets: it returns early
when a value has no hex, so a previous theme's tokens persist. That matches
the original, and matters only if a theme is ever unset at runtime.

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

See `STUDY_GUIDE.md` §11 for suggested next steps (env vars, refresh
tokens).

# Laravel → Vram Admin (Python)

This project is a port of a Laravel + Inertia admin template of the same
name. If you know Laravel, this file is the fastest way in: it maps what
you already know onto what is in `backend/` and `frontend/`, and is
honest about where the mapping breaks down.

The one structural difference to hold in your head before anything else:

> **Laravel is one process that renders pages. This is two servers that
> exchange JSON.**

In Laravel, a request hits `routes/web.php`, a controller returns an
Inertia response, and the same process ships the page shell *and* its
props in one round trip. Authentication rides along in a session cookie
the framework manages for you.

Here, `uvicorn` on `:8000` only ever returns JSON, and Vite on `:5173`
serves the React app. The browser holds a JWT in `localStorage` and
attaches it to every call itself. That single change explains most of the
differences below — no session, so no CSRF token; no shared process, so
no shared props; two servers, so CORS has to be configured explicitly.

Everything in this file is either a stock Laravel 10/11 + Eloquent +
Inertia behaviour or a file you can open in this repo. Where a mapping is
an inference rather than something the code states, it says so.

## The big table

| Concept | Laravel | Vram Admin (Python) | Notes |
|---|---|---|---|
| Dependency manager | `composer install` | `pip install -r requirements.txt` | inside a `venv` — an isolated per-project Python + packages folder, with no Laravel equivalent because Composer already installs per project |
| Task runner / console | `php artisan ...` | no equivalent | one-off jobs are plain scripts you run with `python`, e.g. `python seed.py` |
| Dev server | `php artisan serve` | `uvicorn app.main:app --reload` | `uvicorn` is the ASGI server; FastAPI is only the framework |
| App bootstrap | `bootstrap/app.php` + `app/Http/Kernel.php` | `app/main.py` | creates the app, registers middleware, mounts the router. 23 lines total |
| Global middleware stack | `Kernel::$middleware` | `app.add_middleware(...)` in `main.py` | **registration order is inverted**: the last middleware added ends up outermost, which is why `RequireAuthMiddleware` is added *before* `CORSMiddleware` |
| Route files | `routes/web.php`, `routes/api.php` | `app/api/routers.py` | combines one `APIRouter` per feature area, so `main.py` never changes when a feature is added |
| Controller | `app/Http/Controllers/FooController.php` | a function in `app/api/foo.py` decorated `@router.get("/foo")` | there is no controller *class* for the static routes; the module system is the exception (see [MODULES.md](MODULES.md)) |
| Route middleware | `->middleware('auth')` | `Depends(auth.get_current_user)` in the signature | a parameter default, not a chained call — see "Depends is not middleware" below |
| Gate / Policy | `Gate::allows`, `$this->authorize()` | `Depends(auth.require_role(1))` | checks `adm_roles.id`, not a name or ability string. No policy classes, no `can` middleware |
| Global auth fallback | there isn't one — a route without `auth` is public | `RequireAuthMiddleware` blocks everything not in `PUBLIC_PATHS` | deliberately stricter than Laravel: forgetting the guard fails closed |
| Request validation | `FormRequest` / `$request->validate([...])` | Pydantic schemas in `app/schemas/` | validation failures are `422` with a field-keyed body, same idea as Laravel's `422` |
| Response shaping | API Resource (`UserResource`) | `response_model=schemas.UserOut` plus `api/serializers.py` | `response_model` is what stops a password hash leaking, the same job `UserResource` does |
| ORM model | `app/Models/User.php` (Eloquent) | `app/models/user.py` (SQLAlchemy declarative) | looks similar, behaves differently — see "Eloquent is not SQLAlchemy" |
| Columns | inferred from the table at runtime | declared explicitly as `Column(...)` | Eloquent reads the schema; SQLAlchemy is told. A column missing from the model is invisible to the app |
| Save | `$user->save()` | `db.add(user)` then `db.commit()` | the commit is yours to call, and it commits the whole session, not one row |
| Query | `User::where(...)->get()` | `db.query(models.User).filter(...).all()` | note both SQLAlchemy styles are in this repo: the classic `db.query(...)` in `api/`, and the 2.0 `select(...)` style in `helpers/generated_module.py` |
| Relations | `hasMany` / `belongsTo` methods | `relationship("User", back_populates="role")` | the related class is named as a **string**, which is how two model files link without importing each other |
| Eager loading | `with('role')` | none configured | `user.role` lazy-loads on access inside the session; there is no N+1 guard |
| Migrations | `php artisan make:migration`, `php artisan migrate` | `alembic revision --autogenerate -m "..."`, `alembic upgrade head` | see [MIGRATIONS.md](MIGRATIONS.md). `--autogenerate` diffs the models against the live database, which `make:migration` does not do |
| Migration rollback | `php artisan migrate:rollback` | `alembic downgrade -1` | Alembic revisions form a linked list by hash, not a batch number |
| Seeding | `php artisan db:seed`, seeder classes | `python seed.py` | closest mapping in the project: one `Seeder` subclass per file in `app/seeders/`, each idempotent, ordered by an `order` attribute rather than by `DatabaseSeeder::call([...])`. `python seed.py <Name>` is `--class=`; discovery is by filesystem scan, so there is no `DatabaseSeeder` to register in |
| Config and env | `.env` + `config()` + `config:cache` | **nothing** — literal constants in `core/database.py` and `core/auth.py` | a real gap, not a mapping. `SECRET_KEY` and the Postgres password are in source |
| Password hashing | `Hash::make` / `Hash::check` | `auth.hash_password` / `auth.verify_password` (the `bcrypt` package directly) | same bcrypt underneath. These went through passlib until it broke on bcrypt 5.x — see `core/auth.py`'s comment |
| Current user | `auth()->user()` | a route parameter: `current_user: models.User = Depends(auth.get_current_user)` | there is no ambient global to reach for; if a function needs the user, it must be passed in |
| Session auth | session cookie + `web` guard | JWT in `localStorage`, `Authorization: Bearer <token>` | no cookie, therefore **no CSRF token and no `@csrf`** — the attack it prevents does not apply |
| Logout | `Auth::logout()` invalidates the session | `POST /logout` increments `adm_users.token_version` | JWTs are stateless, so revocation needs a version stamped into the token and compared on every request |
| Token expiry | session lifetime in `config/session.php` | `ACCESS_TOKEN_EXPIRE_MINUTES = 60` in `core/auth.py` | no refresh flow; expiry means logging in again |
| View layer | Blade, or Inertia pages | React + React Router, fetched over axios | |
| Page resolution | Inertia resolves a controller's page name to a component | one splat route in `App.jsx`, plus `import.meta.glob` in `modulePages.js` | the same glob the original's `app.jsx` resolves pages with |
| Shared props | `Inertia::share`, `HandleInertiaRequests` | `AuthContext` calling `GET /me` on mount | the client resolves its own user, because the server never renders a page |
| Persistent layout | an Inertia persistent layout component | `layout/Layout.jsx` wrapping each route element | |
| Sidebar partial | a Blade partial fed from shared props (`auth.sessions.user_menus`/`admin_menus`) | `layout/AppSidebar.jsx` composing `UserSidebar.jsx`/`AdminSidebar.jsx`, fetching `GET /user_sidebar`/`GET /admin_sidebar` | two extra HTTP calls where Laravel had none — no shared-props mechanism to compute them server-side per request |
| Asset build | Vite via `laravel-vite-plugin`, entry in `resources/` | Vite directly, entry `src/main.jsx` | same bundler, no framework wrapper |
| CSS | Tailwind, usually plus AdminLTE in a template of this vintage | Tailwind v4 **and** hand-written semantic CSS side by side, all in `src/index.css` | the semantic CSS is unlayered so it beats Tailwind's layers — read [ARCHITECTURE.md](ARCHITECTURE.md#styling-and-theming) before reaching for a utility |
| Tailwind config | `tailwind.config.js` + `postcss.config.js` | neither — v4 configures itself from an `@theme` block in the CSS | |
| Role theming | an AdminLTE `skin-*` class on `<body>`, chosen server-side | `ThemeContext` stamps `data-app-theme` on `<html>`; `config/themeOptions.js` resolves the value | same `skin-*` vocabulary, driven client-side off `GET /me` |
| DB console | `php artisan tinker`, `php artisan db` | `psql -U vram -d vram_admin` | see [DATABASE.md](DATABASE.md) |
| Interactive API docs | none built in | `http://localhost:8000/docs` | generated from the code by FastAPI, always current |

## Request lifecycle, side by side

**Laravel + Inertia**

```
public/index.php
  -> HTTP kernel, global middleware
  -> route matched in routes/web.php
  -> route middleware ('auth', 'verified', ...)
  -> Controller method
       FormRequest validates
       Eloquent reads/writes (connection resolved from the container)
       Resource shapes the payload
  -> Inertia response: page component name + props
  -> Blade root view, or a JSON prop patch on a subsequent visit
```

**This project**

```
uvicorn
  -> CORSMiddleware (outermost, because it was added last)
  -> RequireAuthMiddleware
       path in PUBLIC_PATHS? pass
       else Bearer token -> get_user_from_token() -> 401 if invalid
  -> route matched in api/routers.py (or the dynamic catch-all, last)
  -> Depends() chain resolves, in order:
       get_db()               opens one SQLAlchemy session for this request
       get_current_user()     decodes the JWT, loads the User row
       require_role(1)        403 before the body runs
  -> route body: SQLAlchemy query
  -> response_model (Pydantic) validates and filters the response
  -> JSON
       React receives it, sets state, re-renders
```

Four differences in there actually bite:

- **No service container.** Nothing is auto-resolved by type across the
  app. `Depends()` looks like injection but is wired explicitly, per
  route, in the signature.
- **Sessions are explicit and per request.** `get_db()` opens one, yields
  it, and closes it in a `finally`. There is no ambient "current
  connection" the way Eloquent has one, so anything touching the database
  must be handed a session.
- **No model events, observers, or global scopes.** Nothing fires on
  save. The `before_store` / `after_store` hooks in `helpers/generated_module.py`
  exist precisely because there is no `booted()` to hook into.
- **The middleware runs before the dependency chain**, so an invalid
  token is rejected without ever opening a route's session. The
  per-route `Depends(get_current_user)` is not redundant — it is what
  hands the `User` object to the body.

### Depends is not middleware

The closest Laravel analogue to `Depends()` is a route middleware that
can also *return a value into the controller*. Two things surprise
Laravel developers:

```python
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(1)),
):
```

1. These are **parameter defaults**. The guard is part of the function
   signature, so a route with no `Depends` has no guard — hence
   `RequireAuthMiddleware` as a backstop.
2. `require_role(1)` is a **factory**: it is called at import time and
   returns the function FastAPI will run per request. The equivalent of
   passing an argument to a middleware, built out of a closure.

## Python for Laravel developers

The language-level things that trip people up, in rough order of how
often they do:

| PHP | Python |
|---|---|
| `{ }` blocks, `;` line ends | **indentation is syntax.** Four spaces, consistently. A misindented line is a different program, not a style problem |
| `$this` | `self`, and it is an *explicit first parameter* on every method |
| `__construct()` | `__init__(self, ...)` |
| `public` / `private` / `protected` | nothing enforced. A leading underscore (`_read_body`) is convention only — which is exactly why `modules/registry.py` has to invent `@action` to mark a method reachable |
| `??` and `?->` | `or` for defaults, explicit `if x is None` for the rest. There is no null-safe operator, so `user.role.name` on a null role raises |
| `array_map` / `array_filter` | comprehensions: `[user_out(u) for u in users]` |
| `use App\Models\User;` | `from app.models.user import User`, and **importing a module executes it** |
| Attributes `#[Route(...)]` | decorators `@router.get("/foo")` — a function that wraps a function |
| Facades (`DB::`, `Hash::`) | plain imported functions and objects; there is no facade layer or container behind them |
| type declarations enforced at runtime | type hints are **advisory** and ignored at runtime, *except* where Pydantic or FastAPI reads them to validate |
| `empty()` truthiness | `0`, `""`, `[]`, `{}`, and `None` are all falsy — but a *coroutine object* is truthy, which is exactly the bug documented in [MODULES.md](MODULES.md#known-gaps) |

Two of these are worth expanding, because the module system is built on
them.

**Decorators.** A decorator is a function that takes a function (or
class) and returns a replacement. Closer to a PHP attribute you wrote the
handler for yourself than to anything in Laravel's public API:

```python
def action(fn):
    fn.__module_action__ = True   # stick a marker on the function object
    return fn                     # hand it back unchanged
```

`@action` above a method just runs that function at class-definition
time. Nothing is generated and nothing is scanned later — the marker is
simply there for `dynamic.py` to check with `getattr`.

**Imports have side effects.** `modules/__init__.py` is three import
lines, and those lines *are* the registration step:

```python
from app.modules import roles_module  # noqa: F401
```

Importing the file runs `@controller("RolesController")`, which puts the
class in the `CONTROLLERS` dict. Laravel would do this with
service-provider auto-discovery or a `config/modules.php` array; here the
import list is the manifest. Forget the line and the module 500s with
"unregistered controller".

## The module system, in Laravel terms

The centrepiece of the port. `app/helpers/generated_module.py` is the Python
counterpart of the Laravel template's
`app/Helpers/GeneratedModuleController.php`: a row in `adm_modules` names
a controller class, the class declares `table_fields` and `form_fields`,
and it inherits a whole searchable, sortable, paginated CRUD surface.
`@controller(...)` plus the `CONTROLLERS` dict does the job Laravel does
by resolving the controller string, and `modulePages.js` globs
`pages/modules/**` to do the job Inertia's `resolve` does when it maps a
page name to a component.

The full treatment — every guard, every hook, the Laravel mapping table,
and the known gaps — is in **[MODULES.md](MODULES.md)**.

## What Laravel gives you that this does not (yet)

Not a criticism of the port; a list of what you will reach for and not
find:

- **Config and env.** No `.env`, no `config()`. `SECRET_KEY`,
  `DATABASE_URL` (password included), the CORS origin, and the frontend's
  `baseURL` are all literals in source.
- **Queues, jobs, scheduling.** No `dispatch()`, no
  `php artisan queue:work`, no scheduler.
- **Events, listeners, observers.** Nothing fires on save.
- **Mail and notifications.** No mailer, no templates.
- **Policies and Gates.** RBAC is `require_role(<id>)` on a route, and
  the dynamic module routes have no role check at all.
- **FormRequest authorization.** Pydantic validates shape; it never
  decides who may call a route.
- **Soft deletes, timestamps, casts, accessors.** All manual — hence
  `has_created_at` / `has_updated_at` flags and `index_row()` in
  `helpers/generated_module.py`.
- **Factories and a test harness.** There are no tests in this repo, and
  no `phpunit`/`pest` equivalent wired up.
- **CSRF.** Genuinely not needed with a bearer token, but worth knowing
  it is absent by design rather than by omission.
- **Resource and route caching.** No `config:cache`, `route:cache`, or
  `view:cache` — nor a need for them at this size.

## See also

- [MODULES.md](MODULES.md) — the dynamic module system in full
- [ARCHITECTURE.md](ARCHITECTURE.md) — the request stack and RBAC model
- [API.md](API.md) — every route
- [MIGRATIONS.md](MIGRATIONS.md) — Alembic, for someone used to `artisan migrate`
- [DATABASE.md](DATABASE.md) — PostgreSQL and `psql`
- `../STUDY_GUIDE.md` — the same ground as a first-principles tutorial

# CLAUDE.md

Vram Admin — FastAPI (Python) backend + React (Vite) frontend, PostgreSQL,
JWT auth, RBAC. A port of a Laravel + Inertia admin template of the same
name, including its metadata-driven module system (a row in `adm_modules`
plus a declarative controller class equals a working CRUD API, no new
route).

## Docs

Read [docs/](docs/) before making non-trivial changes — it's kept current,
not aspirational:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system overview, request stack, RBAC model, styling/theming
- [docs/MODULES.md](docs/MODULES.md) — the dynamic module system, its trust boundaries, known gaps
- [docs/LARAVEL.md](docs/LARAVEL.md) — Laravel → Python mapping, concept by concept
- [docs/DATABASE.md](docs/DATABASE.md) / [docs/MIGRATIONS.md](docs/MIGRATIONS.md) — Postgres setup, Alembic workflow
- [docs/API.md](docs/API.md) + [docs/api/](docs/api/) — route reference, one file per feature area
- [STUDY_GUIDE.md](STUDY_GUIDE.md) — first-principles walkthrough, for someone new to the stack

## The Laravel original, on disk

This project is a port, and the original is not hypothetical — it's
installed locally at **`C:/laragon/www/vram`**, a working Laravel +
Inertia app. Read it directly whenever porting behavior or checking
whether a divergence in this repo is deliberate. This repo's own docs
already cite exact files inside it (`ARCHITECTURE.md`'s component-naming
table, `themeOptions.js`'s own header comment) — those citations are
verified, not guessed.

It carries its own documentation at `C:/laragon/www/vram/docs/vram/`:
`architecture.md`, `generated-modules.md`, `admin-features.md`,
`frontend.md`, `dashboard-builder.md`, `change-process.md`,
`CHANGELOG.md`. Check those alongside this repo's `docs/` — don't infer
the original's behavior from this repo's summary of it when the source
is one `cat` away.

**File correspondence**, confirmed against the real paths:

| Here (`vram-py`) | There (`C:/laragon/www/vram`) |
|---|---|
| `backend/app/helpers/generated_module.py` | `app/Helpers/GeneratedModuleController.php` |
| `backend/app/modules/admin/*_module.py` | `app/Http/Controllers/Admin/*.php` |
| `backend/app/models/admin/*.py` | `app/Models/AdmModels/*.php` |
| `backend/app/modules/admin/module_generator.py` | `app/Http/Controllers/Admin/ModulsController.php` |
| `frontend/src/pages/admvram/vramjsx/GeneratedModulePage.jsx` | `resources/js/Pages/AdmVram/VramJsx/GeneratedModulePage.jsx` |
| `frontend/src/config/themeOptions.js` | `resources/js/Config/themeOptions.js` (verbatim port) |
| `frontend/src/components/` | `resources/js/Components/` (renamed per-folder — see ARCHITECTURE.md's component-family table) |
| `frontend/src/layout/` | `resources/js/Layouts/layout/` |
| `backend/app/api/dynamic.py` catch-all routes | `routes/web.php`'s `routeController()` loop |

**Not yet ported.** `app/Http/Controllers/Admin/` on the Laravel side has
more controllers than this repo has modules for: `AdminApiController`,
`AnnouncementsController`, `EmailTemplatesController`, `LogsController`,
`PrivilegesController`, `SettingsController`, `SystemErrorLogsController`.
`ModulesSeeder` (`backend/app/seeders/modules_seeder.py`) already stages
placeholder `adm_modules` rows for several of these (`api`,
`email-templates`, `settings`, `statistics-builder`,
`logs-user-access`, `logs-system-errors`, `logs-module-activity`) with
**no registered Python controller behind them yet** — each 500s
("names unregistered controller") if hit today.

Those seeded `controller` strings are working guesses, not verified
against the Laravel class names — some don't match: seeded
`LogsModuleActivityController` vs. Laravel's actual
`ModuleActivityHistoryController`; seeded `LogsSystemErrorsController`
vs. Laravel's `SystemErrorLogsController`; seeded `ModulesController` vs.
Laravel's `ModulsController`. Check the real controller file at
`C:/laragon/www/vram/app/Http/Controllers/Admin/` before writing the
Python class and its `@controller(...)` string, rather than trusting the
seeder row's name. See
[docs/MODULES.md](docs/MODULES.md#adding-a-module) for the steps to back
a seeded row with a real module, and check the commented-out
`CONTROLLERS` guard in `modules_seeder.py` before adding more unbacked
rows.

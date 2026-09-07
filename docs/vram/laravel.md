# Laravel mapping

Original application: `C:/laragon/www/vram`. Original documentation:
`C:/laragon/www/vram/docs/vram/`. Read both when porting a feature.

| Python port | Laravel original |
| --- | --- |
| `backend/app/helpers/generated_module.py` | `app/Helpers/GeneratedModuleController.php` |
| `backend/app/modules/admin/` | `app/Http/Controllers/Admin/` |
| `backend/app/models/admin/` | `app/Models/AdmModels/` |
| `backend/app/modules/admin/module_generator.py` | `app/Http/Controllers/Admin/ModulsController.php` |
| `frontend/src/pages/admvram/vramjsx/GeneratedModulePage.jsx` | `resources/js/Pages/AdmVram/VramJsx/GeneratedModulePage.jsx` |
| `frontend/src/config/themeOptions.js` | `resources/js/Config/themeOptions.js` |
| `frontend/src/components/` | `resources/js/Components/` |
| `frontend/src/layout/` | `resources/js/Layouts/layout/` |
| `backend/app/api/dynamic.py` | `routes/web.php` and its dynamic controller loop |

## Contract differences

- Laravel/Inertia carries page props and session identity together. This port
  serves React separately, fetches JSON through Axios, and authenticates with JWT.
- React Router plus `modulePages.js` replaces Inertia page resolution.
- SQLAlchemy models explicitly declare columns; database sessions and commits are
  explicit. Alembic replaces Artisan migrations; `seed.py` runs discovered seeders.
- Python controller actions need `@action`; public method visibility alone does
  not make them routable. `@controller` names must match module metadata exactly.
- Theme and profile state are client contexts. The black palette and built-in
  avatar storage deliberately differ from the current Laravel implementation;
  see [frontend](frontend.md) and [profile](profile-navbar.md).

Controller names in old seed data may be guesses. Examples: Laravel uses
`ModulsController`, `ModuleActivityHistoryController`, and
`SystemErrorLogsController`; do not assume Python seed strings identify those
classes correctly. Check [feature availability](admin-processes.md#availability)
before starting a port.

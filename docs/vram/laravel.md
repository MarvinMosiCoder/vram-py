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
| `backend/app/modules/admin/menus_module.py` | `app/Http/Controllers/Admin/MenusController.php` |
| `frontend/src/pages/modules/menus/index.jsx` | `resources/js/Pages/AdmVram/MenuManagement/MenuManagement.jsx` |
| `adm_menus_roles` | `adm_menus_privileges` |
| `adm_roles_privileges` | `adm_privileges_roles` |

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
- Laravel's `privileges` are this port's `roles`. Two tables carry that rename
  and they are easy to confuse: `adm_roles_privileges` is role x module
  permission flags, while `adm_menus_roles` is role x menu visibility. The
  originals are `adm_privileges_roles` and `adm_menus_privileges`.
- A top-level menu has `parent_id` `NULL` here and `0` in Laravel. Anything
  ported literally from `createMenu`, `updateMenu` or `autoUpdateMenu` has to
  be translated, and the failure is silent: the sidebar simply returns nothing.
- Laravel's forced password change runs from a session flag set in
  `LoginController` and a middleware that redirects; this port computes the
  same decision server-side and serves it from `GET /password-policy`. See
  [admin processes](admin-processes.md#forced-password-change).

Controller names in old seed data may be guesses. Examples: Laravel uses
`ModulsController`, `ModuleActivityHistoryController`, and
`SystemErrorLogsController`; do not assume Python seed strings identify those
classes correctly. Check [feature availability](admin-processes.md#availability)
before starting a port.

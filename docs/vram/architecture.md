# Admin architecture

The browser runs React/Vite and React Router. FastAPI returns JSON through the
shared Axios client; PostgreSQL stores identities, roles, modules, and menus.
This is a port of the Laravel/Inertia project at `C:/laragon/www/vram`.
Its original guides are in `C:/laragon/www/vram/docs/vram/`.

| Responsibility | Source in this repository |
| --- | --- |
| Route composition | `backend/app/api/routers.py` |
| Dynamic module dispatch | `backend/app/api/dynamic.py` |
| Shared CRUD engine | `backend/app/helpers/generated_module.py` |
| Module discovery | `backend/app/modules/registry.py` |
| Admin controller metadata | `backend/app/modules/admin/` |
| Models and seeders | `backend/app/models/admin/`, `backend/app/seeders/` |
| Client route resolution | `frontend/src/pages/ModuleRoute.jsx`, `modulePages.js` |
| Shared generated page | `frontend/src/pages/admvram/vramjsx/GeneratedModulePage.jsx` |
| Admin shell | `frontend/src/layout/` |
| User, theme, profile, toast state | `frontend/src/context/` |

Static API routers must be registered before the dynamic catch-all. A module
request resolves an active `adm_modules` row, finds the registered controller,
and invokes an explicitly decorated `@action` method. React chooses a custom
page from `pages/modules/` or falls back to the generated runtime.

The shell wraps the navbar, sidebar, scrolling content, and footer. The global
ToastProvider is mounted in `main.jsx` above App so login notifications and
notifications raised before navigation survive route changes.

See [Laravel mapping](laravel.md) for source correspondence and port differences.

# Admin architecture

The frontend is migrating to Next.js App Router in `frontend-next/`. Its current
client components call FastAPI through typed fetch helpers. The legacy app in
`frontend/` uses React/Vite, React Router, and a shared Axios client. PostgreSQL
stores identities, roles, modules, and menus. Both frontends share the backend;
see [migration status](frontend.md#migration-status) for current screen coverage.
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
| Next.js routes and root providers | `frontend-next/app/`, `frontend-next/app/layout.tsx` |
| Next.js API helpers | `frontend-next/lib/api.ts`, `frontend-next/lib/http.ts` |
| Next.js generated runtime and Users forms | `frontend-next/components/modules/`, `frontend-next/components/users/` |
| Next.js auth and toast state | `frontend-next/context/` |
| Next.js shared controls | `frontend-next/components/` |
| Next.js admin shell and role theme | `frontend-next/components/layout/`, `frontend-next/context/` |
| Legacy client route resolution | `frontend/src/pages/ModuleRoute.jsx`, `modulePages.js` |
| Legacy shared generated page | `frontend/src/pages/admvram/vramjsx/GeneratedModulePage.jsx` |
| Legacy admin shell | `frontend/src/layout/` |
| Legacy user, theme, profile, toast state | `frontend/src/context/` |

Static API routers must be registered before the dynamic catch-all. A module
request resolves an active `adm_modules` row, finds the registered controller,
and invokes an explicitly decorated `@action` method. The legacy app chooses a custom
page from `pages/modules/` or falls back to the generated runtime.

The legacy shell wraps the navbar, sidebar, scrolling content, and footer. The global
ToastProvider is mounted in `main.jsx` above App so login notifications and
notifications raised before navigation survive route changes.

In Next.js, `app/layout.tsx` mounts ToastProvider around AuthProvider and all
routes. AuthProvider restores the token after mounting and fetches `/me`, password
policy, and announcements. `app/dashboard/layout.tsx` wraps the dashboard with
`RequiredAuth`, typed theme/sidebar providers, and the copied React shell in
`components/layout/`. The dashboard renders the original cards; backend-loaded
sidebar menus and logout confirmation are available. `app/users/layout.tsx`
composes the same shell for Users list/add/edit routes. Other module pages and
policy/announcement gates are not yet ported.

See [Laravel mapping](laravel.md) for source correspondence and port differences.

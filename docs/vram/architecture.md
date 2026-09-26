# Admin architecture

The frontend is migrating to Next.js App Router in `frontend-next/`. Its client
components call FastAPI through typed fetch helpers in `lib/api.ts` (login and
session) and an authenticated Axios client in `lib/http.ts` (shell and modules). The legacy app in
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
| Memecoin analyzer core, rules, and command line | `backend/app/helpers/memecoin/`, routes in `backend/app/api/admin/memecoin.py`, tests in `backend/tests/`; see [memecoin analyzer](memecoin.md) |
| Next.js routes and root providers | `frontend-next/app/`, `frontend-next/app/layout.tsx` |
| Next.js API helpers | `frontend-next/lib/api.ts`, `frontend-next/lib/http.ts` |
| Next.js generated runtime and Users forms | `frontend-next/components/modules/`, `frontend-next/components/users/` |
| Next.js module fallback route | `frontend-next/app/(admin)/[modulePath]/[[...rest]]/page.tsx` |
| Next.js custom screens | `frontend-next/components/roles/`, `menus/`, `chat/` |
| Next.js password and announcement gates | `frontend-next/components/auth/` |
| Next.js auth and toast state | `frontend-next/context/` |
| Next.js shared controls | `frontend-next/components/` |
| Next.js admin shell and role theme | `frontend-next/components/layout/`, `frontend-next/context/` |
| Legacy client route resolution | `frontend/src/pages/ModuleRoute.jsx`, `modulePages.js` |
| Legacy shared generated page | `frontend/src/pages/admvram/vramjsx/GeneratedModulePage.jsx` |
| Legacy admin shell | `frontend/src/layout/` |
| Legacy user, theme, profile, toast state | `frontend/src/context/` |

Static API routers must be registered before the dynamic catch-all. A module
request resolves an active `adm_modules` row, finds the registered controller,
and invokes an explicitly decorated `@action` method. Next.js uses a static
`app/(admin)/<path>/` folder when one exists and otherwise the fallback route,
which renders the generated runtime. The legacy app chooses a custom page from
`pages/modules/` or falls back to the same runtime.

The legacy shell wraps the navbar, sidebar, scrolling content, and footer. The global
ToastProvider is mounted in `main.jsx` above App so login notifications and
notifications raised before navigation survive route changes.

In Next.js, `app/layout.tsx` mounts ToastProvider around AuthProvider and all
routes. AuthProvider restores the token after mounting and fetches `/me`, password
policy, and announcements. `app/(admin)/layout.tsx` wraps every signed-in route
with `RequiredAuth`, typed theme/sidebar providers, the forced password-change
and announcement gates, and the copied React shell in `components/layout/`; see
[shell implementation](frontend.md#shell-implementation).

See [Laravel mapping](laravel.md) for source correspondence and port differences.

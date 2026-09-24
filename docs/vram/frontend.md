# Frontend and Next.js migration

New frontend work targets `frontend-next/`, using Next.js App Router, TypeScript,
React, and Tailwind v4. `frontend/` remains the legacy React/Vite app and the
reference for admin features that have not been migrated. Both use the same
FastAPI backend. Setup commands and CORS configuration live in
[operations](operations.md).

## Migration status

This is an ongoing migration, not feature parity. Status below is based on
source inspection.

| Area | Current `frontend-next/` status |
| --- | --- |
| Routing | `app/page.tsx` redirects `/` to `/login`; `/login` and `/dashboard` exist |
| Login | Responsive login page, validation, password visibility, clock, styled toasts, and navigation to `/dashboard` |
| Authentication | `context/authContext.tsx` stores the token in localStorage, restores identity through `/me`, and exposes refresh/logout |
| Dashboard | Original role, content-access, and user-count cards inside the shared admin layout |
| Password policy and announcements | Auth context fetches and stores both; forced-change and announcement gates are not migrated |
| Notifications | `context/toastContext.tsx` provides shared React Toastify helpers and one container through the root layout |
| Controls | Existing login controls plus copied avatar, modal, confirmation buttons, breadcrumbs, and sidebar cards under `components/` |
| Theme | Shared React theme tokens in `app/globals.css`; `context/ThemeContext.tsx` applies the authenticated role palette |
| Admin shell and navigation | Original navbar, responsive sidebar, backend-loaded menus, breadcrumbs, scrolling content, footer, notification dropdown, and logout confirmation are implemented under `components/` |
| Admin modules | Typed generated runtime plus Users list/view/add/edit are migrated. Roles and menu-management screens remain in `frontend/` |
| Profile, password forms, and AI chat | Remain in `frontend/`; backend endpoints still exist |

`lib/api.ts` currently uses browser `fetch` with hardcoded URLs at
`http://localhost:8080` and explicit bearer headers. The copied shell uses Axios through
`lib/http.ts`, also targeting port 8080 and reading the same localStorage token. Auth context logout clears local state; the API
logout helper exists but is not called by that context. Dashboard protection
is a client redirect; protected API requests still require server authentication.

## Working in Next.js

Use routes under `frontend-next/app/` and the existing `next/navigation` pattern.
Reuse controls in `frontend-next/components/` and the auth/toast contexts mounted
by `app/layout.tsx`. Keep browser state and interactions in client components,
as in `app/login/login-form.tsx`; the login page composes these components.
Read `frontend-next/AGENTS.md` and the relevant installed Next.js guides before
writing code. Do not copy Vite's `import.meta.glob` or React Router routing into
the new app.

When porting a screen, inspect the legacy implementation and its backend contract,
then update the status above. The typed runtime and hooks now live in
`components/modules/GeneratedModulePage.tsx` and `types/modules.ts`. Keep module-specific rendering in wrappers
or custom pages and preserve server validation and access checks.

## Shell implementation

`app/dashboard/layout.tsx` composes the existing `RequiredAuth` wrapper,
`components/layout/AdminProviders.tsx`, and `components/layout/AppShell.tsx`. The dashboard layout
wraps `/dashboard` while excluding login from the shell. Future top-level module
routes can compose the same providers and shell in their own layouts. Root auth/toast
providers are reused, not duplicated. The client auth wrapper controls visible
UI; FastAPI must still authorize protected requests.

Typed TSX components preserve the React app's classes and region structure. Next.js
`Link` and `usePathname` replace React Router. Navbar titles derive from the path;
sidebar expansion is tracked per path. Typed providers handle role themes,
profile state, and sidebar visibility. The account menu is right-aligned to stay
inside the viewport, and dashboard cards can shrink below 220px on narrow screens.

The shell fetches branding, menus, and notification data from the existing API.
The dashboard requests `/admin/users` only for role ID 1. Failed user-count reads
show `Unavailable`. Existing notification endpoints and unported destination
pages retain their backend/migration limitations.

Branding files are copied to Next.js public assets. Uploaded profile images use
an ignored local snapshot; see [operations](operations.md#nextjs-profile-images).
The backend's original image storage is preserved.

## Legacy frontend reference

The theme palette below is shared by the React app and migrated Next.js shell.
References to `useThemeStyles()` and unconverted module/profile screens still concern
`frontend/`. Use the [Users guide](users-nextjs.md) for the migrated module reference.

## Theme process

The authenticated role supplies `theme_color`. ThemeProvider and
`config/themeOptions.js` resolve named skins/custom hex values and set document
colors. `useThemeStyles()` bridges legacy components to shared tokens. A personal
saved-theme dialog from Laravel is not currently implemented in this port.

| Black-theme token | Color |
| --- | --- |
| Page background | `#0f1115` |
| Panel | `#171a21` |
| Border | `#262b35` |
| Main text | `#e7e6e1` |
| Muted text | `#8a8f9c` |
| Mint accent | `#3ecf8e` |
| Text on mint actions | `#0b0d10` |
| Error accent | `#e2665a` |

`body` carries `background-color: var(--bg)` and `color: var(--text)`, so an
element that declares no colour of its own inherits the current theme rather
than the browser default black - which is invisible on the black theme's
charcoal panels. Scoped palettes such as `.login-theme` still win, because they
redefine `--bg`/`--text` on themselves. Prefer an explicit `text-skin-text` or
`text-skin-dim` on anything whose colour matters; the body rule is the floor,
not a licence to leave colour unset.

The black theme retains `skin-black` / `bg-skin-black` identity while adopting
the login charcoal/green palette. Primary controls and active navigation use mint;
surfaces remain charcoal. Profile `--das-*` aliases follow these tokens in black
mode. The `.login-theme` palette is scoped independently of the signed-in role.

Check light/black themes, narrow viewports, focus states, dropdowns, and modals
when changing shared styling. Keep icon controls labeled and preserve text/icons
alongside status colors. The navbar has mobile-specific layout rules and the
sidebar becomes an overlay; avoid clipping either with new fixed-width content.

For notification colors, see [response notifications](notifications.md).

## Chat composer

The chat composer, its settings selector, and its theme usage are documented
in the [AI chat](ai-chat.md) guide.

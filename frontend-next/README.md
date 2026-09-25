# VRAM Next.js frontend

Next.js App Router port of the React/Vite app in `../frontend/`, using
TypeScript, React, and Tailwind v4 with the existing FastAPI backend. It covers
every route the legacy app serves: login, dashboard, Users, Roles, Profile,
Change Password, Menu management, AI chat, a fallback route for other generated
modules, and the forced password-change and announcement gates.

See [migration status and frontend guidance](../docs/vram/frontend.md) and
[project documentation](../docs/vram/README.md).

## Local development

Start FastAPI on port 8080 and configure its `CORS_ORIGINS` to include
`http://localhost:3000`, following [operations](../docs/vram/operations.md).
Then run from this directory:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`; `/` redirects to `/login`. API helpers in
`lib/api.ts` currently hardcode `http://localhost:8080`; they do not read an
API URL environment variable.

## Source and checks

- `app/`: routes, root layout, and global styles.
- `context/`: auth and toast providers mounted by `app/layout.tsx`.
- `components/`: typed shared controls, navigation, and admin shell.
- `lib/api.ts`: typed fetch helpers for FastAPI.
- `app/(admin)/layout.tsx`: authenticated shared layout for every admin route,
  using `components/auth/RequiredAuth.tsx` and the gates in `components/auth/`.
- `app/(admin)/[modulePath]/[[...rest]]/page.tsx`: generated-module fallback.
- `components/layout/`: shell regions and authenticated providers.
- `config/themeOptions.ts`: role palette calculations.
- `lib/http.ts`: Axios client sharing the current auth token.
- `types/admin.ts`: menu and notification response types.

The dashboard is implemented directly in `app/(admin)/dashboard/page.tsx`. Components
use Next.js navigation and TSX; there is no separate migration component tree.

Branding assets are copied into `public/images/settings/`. Profile images use a
local, git-ignored snapshot; see [image setup](../docs/vram/operations.md#nextjs-profile-images).

Run `npm run lint` and `npm run build` for frontend changes. `npm run start`
serves a completed production build. Read [AGENTS.md](AGENTS.md) and the
relevant installed Next.js guides before writing code.

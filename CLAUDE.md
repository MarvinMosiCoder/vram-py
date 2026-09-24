# Project instructions

Read [docs/vram/README.md](docs/vram/README.md) and the affected guide before
non-trivial changes. Follow [the change process](docs/vram/change-process.md).
Preserve unrelated working-tree changes and user-uploaded files.

The frontend is migrating to Next.js in `frontend-next/`; target new frontend
work there unless the task explicitly concerns the legacy Vite app in `frontend/`.
Read [frontend migration status](docs/vram/frontend.md#migration-status) and
`frontend-next/AGENTS.md` before working on the Next.js app. The migration is
incomplete; do not assume legacy admin screens exist in Next.js.

The original Laravel application is installed at `C:/laragon/www/vram`.
Read its source and `docs/vram/` guides directly when porting behavior; do not
infer the original from this port. [Laravel mapping](docs/vram/laravel.md)
identifies corresponding files.

The Python port is incomplete. Check registered controllers, actual API response
shapes, and server permission checks before treating a seeded module as working.
[Admin processes](docs/vram/admin-processes.md) owns the current availability list.

Put module-specific behavior in metadata or wrapper hooks rather than copying
or special-casing the shared runtime. Document changes under `docs/vram/`, keeping
one guide responsible for each topic.

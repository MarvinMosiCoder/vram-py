# VRAM documentation

Project guides live here. The frontend is `frontend-next/` (Next.js); `frontend/`
keeps the legacy React/Vite implementation as a porting reference. See
[migration status](frontend.md#migration-status) for coverage. Choose the guide for the task:

| Guide | Responsibility |
| --- | --- |
| [Operations](operations.md) | Install, configure, run, seed, troubleshoot |
| [Architecture](architecture.md) | Layers and source ownership |
| [Admin processes](admin-processes.md) | Login, users, roles, menus, feature availability |
| [Generated modules](generated-modules.md) | Create and customize a module |
| [Users in Next.js](users-nextjs.md) | Complete conversion reference, files, endpoints, and checks |
| [Module reference](module-reference.md) | Controller metadata and frontend extension hooks |
| [API reference](api.md) | Endpoints, request parameters, response conventions |
| [AI chat](ai-chat.md) | Chat endpoint, memory, cost controls, composer |
| [Memecoin analyzer](memecoin.md) | Solana coin checker: status, collectors, rule engine, command line, API, tests |
| [Profile and navbar](profile-navbar.md) | Image workflows and live navbar updates |
| [Frontend](frontend.md) | Next.js migration status, shared controls, themes, responsive design |
| [Notifications](notifications.md) | Toastify usage and per-component styling |
| [Migrations](migrations.md) | Review and apply database schema changes |
| [Laravel mapping](laravel.md) | Original source correspondence and port differences |
| [Change process](change-process.md) | Implementation and verification checklist |
| [Changelog](CHANGELOG.md) | Documented changes and baseline |

Read the affected guide before changing behavior. Verify implementation details
against source; seeded metadata alone does not establish feature availability.

# Admin operations

## Local setup

Install PostgreSQL and create a database owned by the application role.
Create `backend/.env` with `DATABASE_URL` and `SECRET_KEY`. Settings are loaded by
`backend/app/core/config.py` using pydantic-settings; these values have no defaults.
Use a PostgreSQL SQLAlchemy URL such as
`postgresql+psycopg2://<user>:<password>@localhost:5432/<database>` and a generated
secret. Optional settings include `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, and
`CORS_ORIGINS` (a JSON array). Do not commit local credentials.

Check PostgreSQL with `Get-Service postgresql*`. If `psql` is unavailable on PATH,
use the installed PostgreSQL `bin/psql.exe` path. Connect using `psql -U <user> -d
<database>`; `\dt` lists tables and `\d <table>` describes one. The application and
Alembic both use the same configured database URL.

From `backend/`, run:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python seed.py
uvicorn app.main:app --reload --port 8080
```

From `frontend-next/` (the active migration target):

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Set this in `backend/.env` and restart FastAPI:

```dotenv
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

The backend default permits only the legacy Vite origin on port 5173. Include
the actual browser origin if using another hostname or port. The Next.js client
calls FastAPI directly; `next.config.ts` currently defines no API proxy.

For admin screens not yet migrated, run the same npm commands from `frontend/`
and open the Vite app, normally at `http://localhost:5173`. See
[migration status](frontend.md#migration-status) for the available Next.js screens.

`GEMINI_API_KEY` is needed only by [AI chat](ai-chat.md). The client is built on
first use, so the backend starts without it and the first chat request fails
instead; the rest of the admin is unaffected. `CHAT_FAKE=1` answers chat from a
canned stub that reaches no provider and needs no key - a development setting
for working on the chat stack without spending the free tier's 20 daily
requests, never for judging a reply. See [stub mode](ai-chat.md#stub-mode).

`REDIS_URL` is optional and only needed before running more than one worker; see
[AI chat](ai-chat.md#shared-state-redis). Windows has no native Redis server -
use Docker, WSL, or a hosted instance. Left unset, the chat rate limiter and
response cache stay in process memory and no Redis is required.

The command above serves FastAPI on 8080 to match both the fetch helpers in
`frontend-next/lib/api.ts` and the legacy Axios client in `frontend/src/api.js`.
Both currently hardcode `http://localhost:8080`. Interactive API reference is at
`http://localhost:8080/docs`. Uvicorn without `--port` defaults to 8000; keep the
server port and client URLs aligned. The Next.js helpers do not read an API URL
environment variable. The legacy client does not read `VITE_API_URL` (shown as
port 8000 in `frontend/.env.example`). Inspect configuration rather than
assuming a deployed instance uses the same addresses or credentials.

## Next.js profile images

Branding files are included in `frontend-next/public/images/settings/`. The
backend still writes profile uploads under `frontend/public/images/profile/`.
For local development, copy a snapshot from the repository root:

```powershell
New-Item -ItemType Directory -Force -Path ./frontend-next/public/images/profile
Copy-Item -Path ./frontend/public/images/profile/* -Destination ./frontend-next/public/images/profile -Force
```

The destination is git-ignored to keep user uploads out of the migration commit.
Restart the Next.js production server after adding files. This is a snapshot:
refresh it after uploads; deletion in the backend does not delete snapshot files.
A shared upload-serving location is required before deploying the profile editor.
The original backend-managed directory remains authoritative.

## Data maintenance

Follow [migrations](migrations.md) for schema changes and
[generated modules](generated-modules.md) for controller generation.
Seeders may update existing metadata; inspect their contents before running them
against an established database. Preserve the database and profile image storage
together in backups. Uploaded files are not frontend build artifacts.

## Troubleshooting

| Symptom | First check |
| --- | --- |
| Module 404 | Active module row, path, decorated action, argument count |
| Unregistered-controller 500 | Controller string and discovered class; seeded placeholders |
| Form request fails | Network response `detail`/`errors`, field values, API origin |
| Permission changes appear ineffective | Capability helper limitation in [admin guide](admin-processes.md) |
| Navbar shows initials | `/me` profile filename, context value, image request/path |
| Toast disappears on save | Unexpected browser reload or duplicate provider |
| Wrong login toast colors | Local `notifyLogin` options; container is outside `.login-theme` |
| Next.js login blocked by CORS | Backend `CORS_ORIGINS` includes the browser origin, normally `http://localhost:3000` |
| Admin screen is 404 in Next.js | Check migration status; most admin screens still exist only in `frontend/` |

Run `npm run lint` and `npm run build` from `frontend-next/` after Next.js changes.
To serve its production build, run `npm run start` from that directory. For legacy
frontend changes, run `npm run build` from `frontend/`. For backend changes,
run relevant existing tests and exercise both successful and rejected requests.

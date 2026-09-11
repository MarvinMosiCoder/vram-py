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
uvicorn app.main:app --reload
```

From `frontend/`:

```powershell
npm install
npm run dev
```

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

Vite normally serves port 5173; FastAPI serves 8000 and exposes interactive API
reference at `/docs`. Inspect configuration rather than assuming a deployed
instance uses the same addresses or credentials.

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

Run `npm run build` from `frontend/` after frontend changes. For backend changes,
run relevant existing tests and exercise both successful and rejected requests.

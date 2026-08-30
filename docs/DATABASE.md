# Database Setup (PostgreSQL)

Everything the backend needs to talk to a database, from a machine with
nothing installed to `uvicorn` serving requests. For *changing* the schema
afterwards see [MIGRATIONS.md](MIGRATIONS.md); for how the connection is
wired into the app see [ARCHITECTURE.md](ARCHITECTURE.md#database).

## What the app expects

`backend/app/core/database.py` holds one line that defines all of it:

```python
DATABASE_URL = "postgresql+psycopg2://vram:vram@localhost:5432/vram_admin"
```

Read it as `dialect+driver://user:password@host:port/database`:

| | |
|---|---|
| **Server** | PostgreSQL (developed against 17) on `localhost`, port `5432` |
| **Database** | `vram_admin` |
| **Login role** | `vram`, password `vram` |
| **Driver** | `psycopg2-binary`, installed by `requirements.txt` |

Nothing else in the project hardcodes a connection — `alembic/env.py`
imports `DATABASE_URL` from this same file, so the app and the migrations
always agree.

## 1. Install PostgreSQL (Windows)

1. Download the EnterpriseDB installer from
   <https://www.postgresql.org/download/windows/> and run it.
2. During setup:
   - **Remember the password you set for the `postgres` superuser** — you
     need it once, in step 2, and there's no recovering it later.
   - Leave the port at **5432** (the URL above assumes it).
   - Keep pgAdmin 4 ticked if you want a GUI; everything below also works
     without it.
3. The installer registers a Windows service that starts on boot. Check it:
   ```powershell
   Get-Service postgresql*
   ```
   `Status: Running` means the server is up. If it isn't:
   ```powershell
   Start-Service postgresql-x64-17
   ```

### Getting `psql` on your PATH (optional, but everything below assumes it)

The installer does **not** add `psql` to your PATH, so a bare `psql` says
"not recognized". Either call it by full path:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" --version
```

...or add `C:\Program Files\PostgreSQL\17\bin` to your PATH once (System
Properties -> Environment Variables -> Path -> New) and reopen the
terminal.

## 2. Create the role and the database

One time, as the `postgres` superuser (it prompts for the password from
step 1):

```powershell
psql -U postgres -c "CREATE USER vram WITH PASSWORD 'vram';"
psql -U postgres -c "CREATE DATABASE vram_admin OWNER vram;"
```

`OWNER vram` matters: the migrations create tables while connected as
`vram`, and owning the database is what gives that role permission to do
so. If the database already exists under a different owner, fix it with
`ALTER DATABASE vram_admin OWNER TO vram;`.

Confirm the login works end to end:

```powershell
psql -h localhost -U vram -d vram_admin -c "SELECT current_user, current_database();"
```

Prefer a GUI? The same thing in pgAdmin: connect to the local server with
the `postgres` password -> *Login/Group Roles* -> Create -> Login/Group
Role (name `vram`, Definition -> password, Privileges -> **Can login**)
-> *Databases* -> Create -> Database (name `vram_admin`, owner `vram`).

## 3. Install the Python side

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

`psycopg2-binary` in that file is the actual PostgreSQL driver.
SQLAlchemy is only the ORM — without the driver, the first connection
attempt fails with `ModuleNotFoundError: No module named 'psycopg2'`.

## 4. Create the tables

The database from step 2 is **empty** — no tables at all. Nothing builds
them at startup any more (`main.py` no longer calls
`Base.metadata.create_all()`), so this step isn't optional:

```powershell
cd backend
alembic upgrade head
```

That replays every migration in `backend/alembic/versions/` in order and
leaves you with `adm_roles`, `adm_users`, `adm_modules`, `adm_menuses`
and `adm_admin_menuses`, plus alembic's own `alembic_version` bookkeeping
table.

## 5. Seed the first login

```powershell
python seed.py
```

Creates the `Super Administrator` role and `admin@vram.com` / `admin123`.
Safe to re-run — it checks for the existing rows first.

Then start the API:

```powershell
uvicorn app.main:app --reload
```

## 6. Verify it all landed

```powershell
psql -h localhost -U vram -d vram_admin -c "\dt"
alembic current          # from backend/, with the venv active
```

You should see the six tables, and a revision id matching the last entry
in [MIGRATIONS.md](MIGRATIONS.md#this-projects-migration-history) —
currently `4a53b9d60757`. To check the seed:

```powershell
psql -h localhost -U vram -d vram_admin -c "SELECT id, email, id_adm_role FROM adm_users;"
```

No `psql`? The same checks through the app's own connection:

```powershell
cd backend
python -c "from sqlalchemy import inspect; from app.core.database import engine; print(inspect(engine).get_table_names())"
```

## psql cheat sheet

Open a session with `psql -h localhost -U vram -d vram_admin`, then:

| Command | What it does |
|---|---|
| `\l` | list databases |
| `\dt` | list tables in the current database |
| `\d adm_users` | describe one table — columns, types, indexes, FKs |
| `\du` | list roles and their attributes |
| `\x` | toggle expanded output (readable rows for wide tables) |
| `SELECT * FROM adm_roles;` | plain SQL — **must end with a `;`** |
| `\q` | quit |

Backslash commands are psql's own, not SQL, and don't take a semicolon.
A prompt reading `vram_admin-#` instead of `vram_admin=#` means psql is
still waiting for you to close the statement with `;`.

## Starting over from scratch

To wipe the schema and rebuild it from the migrations — the fastest way
back to a known-good state while developing:

```powershell
psql -h localhost -U vram -d vram_admin -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
cd backend
alembic upgrade head
python seed.py
```

This destroys every row, including anything you added by hand. Dropping
the *schema* rather than the database leaves the role, its permissions
and the connection URL untouched, so nothing else needs reconfiguring.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `connection to server at "localhost", port 5432 failed: Connection refused` | The server isn't running. `Get-Service postgresql*`, then `Start-Service postgresql-x64-17`. |
| `password authentication failed for user "vram"` | The role's password isn't `vram`. Reset it with `psql -U postgres -c "ALTER USER vram WITH PASSWORD 'vram';"`, or change `DATABASE_URL` to match what you actually set. |
| `FATAL: database "vram_admin" does not exist` | Step 2 was skipped, or you created it on a different server/port. |
| `FATAL: role "vram" does not exist` | Same — the `CREATE USER` half of step 2. |
| `ModuleNotFoundError: No module named 'psycopg2'` | Dependencies not installed, or installed into a different venv. Activate the venv, then `pip install -r requirements.txt`. |
| `permission denied for schema public` | The `vram` role doesn't own the database: `psql -U postgres -c "ALTER DATABASE vram_admin OWNER TO vram;"` and, on PG 15+, `psql -U postgres -d vram_admin -c "GRANT ALL ON SCHEMA public TO vram;"`. |
| `relation "adm_users" does not exist` at runtime | The database exists but the tables don't — run `alembic upgrade head` (step 4). |
| `psql : The term 'psql' is not recognized` | Not on PATH — use the full `C:\Program Files\PostgreSQL\17\bin\psql.exe`, see step 1. |
| Port 5432 already in use | An older PostgreSQL is still installed and running. Stop it, or install on another port and update the port in `DATABASE_URL`. |

## Pointing at a different database

Change the one line in `backend/app/core/database.py` — a teammate's
server, a Docker container, a staging box. The app picks it up on the
next start, and alembic picks it up automatically because `env.py`
imports the same constant.

Two things to know first:

- The password sits in source, in plain text, and gets committed. Moving
  `DATABASE_URL` into an environment variable is the first hardening step
  in `STUDY_GUIDE.md` §10, and it's now a one-place change.
- A brand-new target database still needs steps 2, 4 and 5 — role and
  database, `alembic upgrade head`, `seed.py` — before it serves anything.

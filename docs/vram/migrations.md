# Database migrations

Run commands from `backend/` with its virtual environment active. Complete
[configuration](operations.md#local-setup) first. Alembic imports
`settings.DATABASE_URL` from `app/core/config.py`, the same configuration used by
the app. Model imports populate `Base.metadata` in `alembic/env.py`.

## Change the schema

1. Update the SQLAlchemy model. Import new model files through the model package
   so Alembic can see their tables.
2. Generate a revision:

   ```powershell
   alembic revision --autogenerate -m "describe the schema change"
   ```

3. Review `upgrade()` and `downgrade()` in the new file under `alembic/versions/`.
   Check drops, renames, constraints, nullable changes, and existing data handling.
4. Apply and verify:

   ```powershell
   alembic upgrade head
   alembic current
   ```

Use `alembic history` and `alembic heads` to inspect the revision chain. A reviewed
`alembic downgrade -1` rolls back one revision and may remove data.

## Troubleshooting

An empty generated migration means no detected difference. Check the selected
database, model imports, and actual schema before deciding whether a revision is
needed. Do not drop existing tables just to make autogeneration produce output.

If a revision is missing, recover the migration file from version control first.
Compare the actual schema with the migration chain before repairing version
metadata. `alembic stamp` changes bookkeeping only; it does not apply schema
changes. Avoid copying historical revision IDs or reset commands from another
installation.

The revision files are the migration history; this guide does not maintain a
second list of them. Back up database and related profile files before changes
that remove or transform stored data.

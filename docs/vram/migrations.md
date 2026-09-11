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

## Column changes

Every column change runs the same loop: edit the model, generate a revision,
review it, apply it. What differs is how much autogenerate gets right. Because
`alembic/env.py` sets `render_as_batch=True`, generated operations arrive wrapped
in `op.batch_alter_table`; keep that form so revisions stay consistent.

Autogenerate compares all of `Base.metadata` against the live database, so a
generated revision can carry drift you did not intend. Remove anything outside
the change you are making before applying it.

### Add a column

1. Add the attribute to the model under `backend/app/models/admin/`.
2. Decide nullability. A nullable column needs nothing further. A `nullable=False`
   column needs a `server_default` for the rows that already exist, or the upgrade
   fails on a populated table.
3. Generate, review, and apply as above.

```python
def upgrade() -> None:
    with op.batch_alter_table("chat_conversations", schema=None) as batch_op:
        batch_op.add_column(sa.Column("archived_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("chat_conversations", schema=None) as batch_op:
        batch_op.drop_column("archived_at")
```

A Python-side `default=` is applied by SQLAlchemy on insert and never reaches the
database; only `server_default` backfills existing rows. `chat_conversations.summary`
declares both, for the two different jobs.

### Drop a column

The upgrade destroys that column's data, and `downgrade()` does not return it -
it re-creates an empty column. Back up before applying.

1. Remove the readers first. Search the column name across `backend/app/` and
   `frontend/src/` before touching the model; a name that survives in controller
   metadata or a Pydantic model outlives the column itself.
2. Remove the model attribute, then generate and review.
3. Check the generated `downgrade()`. Re-adding a `nullable=False` column to a
   populated table fails unless the downgrade supplies a `server_default`.

### Rename a column

**Autogenerate cannot detect a rename.** It sees one column disappear and another
appear, and emits a drop plus an add, which discards the data. Write the operation
by hand instead:

```python
def upgrade() -> None:
    with op.batch_alter_table("chat_conversations", schema=None) as batch_op:
        batch_op.alter_column("summary", new_column_name="context_summary")


def downgrade() -> None:
    with op.batch_alter_table("chat_conversations", schema=None) as batch_op:
        batch_op.alter_column("context_summary", new_column_name="summary")
```

Either replace the generated drop/add pair before applying, or skip detection
altogether with `alembic revision -m "rename ..."` and fill in an empty revision.

### Change a type or nullability

`alter_column` needs `existing_type` so the operation stays reversible. Making a
column `NOT NULL` on a populated table requires backfilling in the same upgrade,
ordered ahead of the alter:

```python
def upgrade() -> None:
    op.execute("UPDATE chat_conversations SET title = '' WHERE title IS NULL")

    with op.batch_alter_table("chat_conversations", schema=None) as batch_op:
        batch_op.alter_column(
            "title", existing_type=sa.String(length=255), nullable=False
        )
```

PostgreSQL refuses a type change it cannot cast implicitly; supply
`postgresql_using="<column>::<type>"` for those. A narrowing change - `Text` to
`String`, or a shorter length - fails or truncates against existing values, so
check the stored data before applying. `summary` is `Text` for exactly this
reason; see [AI chat](ai-chat.md#storage).

### After any column change

The database is not the only place a column is named. Check every layer that
lists columns explicitly:

| Layer | What to check |
| --- | --- |
| Model | Attribute and any relationship in `backend/app/models/admin/` |
| Schemas | Pydantic request and response models name their fields explicitly |
| Controller metadata | `table_fields`, `form_fields`, `search_columns`, `default_sort`, filters, exports |
| Seeders | Rows in `backend/app/seeders/` that write the column |
| Frontend | Wrapper hooks and custom pages that read the field |

A dropped or renamed column still declared in `table_fields` or `default_sort`
returns 500 from the module list. See [module reference](module-reference.md) for
the metadata and [API](api.md#response-conventions) for the status meanings.

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

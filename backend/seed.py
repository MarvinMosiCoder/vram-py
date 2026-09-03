"""Seeder runner. Run from backend/, with the venv active:

    python seed.py                 run every seeder, in `order`
    python seed.py RolesSeeder     run only the ones named
    python seed.py --list          show what is registered
    python seed.py --help

Every seeder is idempotent, so re-running is safe and cheap.

Seeders live in app/seeders/, one `<name>_seeder.py` each. Dropping a file
there registers it -- the filesystem is the registry, same rule the module
system uses. See app/seeders/base.py for the contract.

This no longer calls Base.metadata.create_all(). It used to, which meant
running seed.py after adding a model but before generating its migration
let create_all() beat alembic to creating the table, and the resulting
migration came out empty (docs/MIGRATIONS.md). Migrations are now the only
thing that builds schema, so run `alembic upgrade head` first -- the check
below says so plainly if you have not.
"""
import sys

from sqlalchemy import inspect

from app.core.database import SessionLocal, engine
from app.seeders import discover, ordered, SEEDERS

# Tables a seeder writes to. Checked up front so a missing schema is one
# clear message rather than a ProgrammingError from inside a seeder.
REQUIRED_TABLES = ["adm_roles", "adm_users", "adm_modules"]


def check_schema():
    missing = sorted(set(REQUIRED_TABLES) - set(inspect(engine).get_table_names()))
    if missing:
        sys.exit(
            "These tables do not exist yet: %s\n"
            "Migrations are the only thing that creates the schema. Run:\n"
            "    alembic upgrade head" % ", ".join(missing)
        )


def list_seeders():
    print("Registered seeders (in run order):\n")
    for cls in ordered():
        print("  %-4s %-20s %s" % (cls.order, cls.__name__, cls.description))
    print("\nRun all with `python seed.py`, or one with "
          "`python seed.py <Name>`.")


def run(selected=None):
    check_schema()

    classes = ordered()
    if selected:
        unknown = [name for name in selected if name not in SEEDERS]
        if unknown:
            sys.exit(
                "Unknown seeder(s): %s\nTry `python seed.py --list`."
                % ", ".join(unknown)
            )
        # Still in `order`, not the order they were typed -- dependencies
        # hold regardless of how the arguments were written.
        classes = [cls for cls in classes if cls.__name__ in selected]

    db = SessionLocal()
    failed = False
    try:
        for cls in classes:
            instance = cls()
            try:
                instance.run(db)
            except Exception as exc:          # noqa: BLE001 -- reported, not swallowed
                db.rollback()
                print("  x %-20s %s" % (cls.__name__, exc))
                failed = True
                break
            print("  - %-20s %s" % (cls.__name__, instance.summary))
    finally:
        db.close()

    if failed:
        sys.exit("\nSeeding stopped at the failure above; nothing after it ran.")
    print("\nDone.")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a]

    if "--help" in args or "-h" in args:
        print(__doc__)
    elif "--list" in args or "-l" in args:
        discover()
        list_seeders()
    else:
        discover()
        run(selected=args or None)

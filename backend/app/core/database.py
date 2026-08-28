from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite database file — will be created automatically as app.db
DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)


@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
    # SQLite ignores FK constraints unless this is set per-connection —
    # without it, a bad id_adm_role would insert silently instead of erroring.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    FastAPI dependency: opens a database session for one request,
    hands it to the route function, then always closes it
    (the 'finally' runs even if the route raises an error).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

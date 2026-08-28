from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite database file — will be created automatically as app.db
DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

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

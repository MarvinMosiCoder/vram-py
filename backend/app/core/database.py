from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
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

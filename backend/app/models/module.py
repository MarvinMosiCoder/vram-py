from sqlalchemy import Column, DateTime, Integer, String

from app.core.database import Base


class Modules(Base):
    __tablename__ = "adm_modules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=True)
    icon = Column(String(255), nullable=True)
    path = Column(String(255), nullable=True)
    table_name = Column(String(255), nullable=True)
    controller = Column(String(255), nullable=True)
    is_protected = Column(Integer, nullable=True)
    is_active = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

from sqlalchemy import Column, DateTime, Integer, String

from app.core.database import Base

class AdminMenuses(Base):
    __tablename__ = "adm_admin_menuses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=True)
    type = Column(String(255), nullable=True)
    path = Column(String(255), nullable=True)
    slug = Column(String(255), nullable=True)
    color = Column(String(255), nullable=True)
    icon = Column(String(255), nullable=True)
    parent_id = Column(Integer, nullable=True)
    is_active = Column(Integer, nullable=True)
    sorting = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

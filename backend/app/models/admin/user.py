from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "adm_users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))
    email = Column(String(255), unique=True, index=True)
    email_verified_at = Column(DateTime, nullable=True)
    password = Column(String(255))
    id_adm_role = Column(Integer, ForeignKey("adm_roles.id"), nullable=True)
    token_version = Column(Integer, nullable=False, default=0, server_default="0")
    status = Column(String(50), nullable=True)
    last_password_updated = Column(Date, nullable=True)
    waiver_count = Column(Integer, nullable=True)
    theme = Column(String(199), nullable=True)
    remember_token = Column(String(100), nullable=True)
    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_by = Column(Integer, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    role = relationship("Role", back_populates="users")

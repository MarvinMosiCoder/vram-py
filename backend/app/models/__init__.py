from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, Date
from sqlalchemy.orm import relationship
from app.core.database import Base


class Role(Base):
    __tablename__ = "adm_roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))
    is_superadmin = Column(Integer, nullable=True)
    theme_color = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    users = relationship("User", back_populates="role")


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
    menuses = relationship("Menuses", back_populates="module")

class Menuses(Base):
    __tablename__ = "adm_menuses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=True)
    type = Column(String(255), nullable=True)
    path = Column(String(255), nullable=True)
    slug = Column(String(255), nullable=True)
    color = Column(String(255), nullable=True)
    icon = Column(String(255), nullable=True)
    patent_id = Column(Integer, ForeignKey("adm_modules.id"), nullable=True)
    is_active = Column(Integer, nullable=True)
    is_dashboard = Column(Integer, nullable=True)
    id_adm_role = Column(Integer, ForeignKey("adm_roles.id"), nullable=True)
    sorting = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    module = relationship("Modules", back_populates="menuses")
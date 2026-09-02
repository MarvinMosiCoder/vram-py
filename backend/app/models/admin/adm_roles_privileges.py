from sqlalchemy import Column, DateTime, Integer, String

from app.core.database import Base

class AdminRolesPrivileges(Base):
    __tablename__ = "adm_roles_privileges"

    id = Column(Integer, primary_key=True, index=True)
    is_visible = Column(Integer, nullable=True)
    is_create = Column(Integer, nullable=True)
    is_read = Column(Integer, nullable=True)
    is_edit = Column(Integer, nullable=True)
    is_delete = Column(Integer, nullable=True)
    is_void = Column(Integer, nullable=True)
    is_override = Column(Integer, nullable=True)
    id_adm_roles = Column(Integer, nullable=True)
    id_adm_modules = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
  

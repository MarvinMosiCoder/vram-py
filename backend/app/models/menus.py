from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.core.database import Base


class Menuses(Base):
    __tablename__ = "adm_menuses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=True)
    type = Column(String(255), nullable=True)
    path = Column(String(255), nullable=True)
    slug = Column(String(255), nullable=True)
    color = Column(String(255), nullable=True)
    icon = Column(String(255), nullable=True)
    # A menu's parent is another menu (an accordion group), not a module --
    # NULL means top level.
    parent_id = Column(Integer, ForeignKey("adm_menuses.id"), nullable=True)
    is_active = Column(Integer, nullable=True)
    is_dashboard = Column(Integer, nullable=True)
    id_adm_role = Column(Integer, ForeignKey("adm_roles.id"), nullable=True)
    sorting = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

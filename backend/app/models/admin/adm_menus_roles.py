from sqlalchemy import Column, ForeignKey, Integer
from app.core.database import Base


class MenusRoles(Base):
    """Which roles can see a menu. Laravel's adm_menus_privileges; renamed
    because `privileges` in this port means a role's module permission flags."""
    __tablename__ = "adm_menus_roles"

    id = Column(Integer, primary_key=True, index=True)
    id_adm_menus = Column(Integer, ForeignKey("adm_menuses.id"), nullable=False)
    id_adm_role = Column(Integer, ForeignKey("adm_roles.id"), nullable=False)

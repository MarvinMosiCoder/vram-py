from sqlalchemy import Column, DateTime, Integer, String
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

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class AdmUserProfiles(Base):
    __tablename__ = "adm_user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    adm_user_id = Column(Integer, ForeignKey("adm_users.id"), nullable=False)
    file_name = Column(String(255), nullable=True)
    ext = Column(String(255), nullable=True)
    created_by = Column(Integer, nullable=True)
    archived = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    user = relationship("User", back_populates="profile")

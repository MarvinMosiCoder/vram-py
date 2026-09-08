from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class AdminNotifications(Base):
    __tablename__ = "adm_notifications"

    id = Column(Integer, primary_key=True, index=True)
    adm_user_id = Column(Integer, ForeignKey("adm_users.id"), nullable=True)
    type = Column(String(255), nullable=True)
    content = Column(String(255), nullable=True)
    url = Column(String(255), nullable=True)
    is_read = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

    user = relationship(
        "User",
        back_populates="notifications",
        foreign_keys="[AdminNotifications.adm_user_id]",
    )

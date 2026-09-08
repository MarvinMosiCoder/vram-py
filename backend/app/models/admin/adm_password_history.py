from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class AdminPasswordHistory(Base):
    __tablename__ = "adm_password_history"

    id = Column(Integer, primary_key=True, index=True)
    adm_user_id = Column(Integer, nullable=True)
    adm_user_old_pass = Column(String(255), nullable=True)
    updated_by = Column(Integer, nullable=True)
    updated_at = Column(DateTime, nullable=True)



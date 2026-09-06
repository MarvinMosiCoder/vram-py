from sqlalchemy import TEXT, Column, DateTime, Integer, String, Text

from app.core.database import Base


class Modules(Base):
    __tablename__ = "adm_settings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=True)
    content = Column(Text, nullable=True)
    content_input_type = Column(String(255), nullable=True)
    dataenum = Column(String(255), nullable=True)
    helper = Column(String(255), nullable=True)
    group_setting = Column(Integer, nullable=True)
    label = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

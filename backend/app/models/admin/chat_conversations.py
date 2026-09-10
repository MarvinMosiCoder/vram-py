from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class ChatConversations(Base):
    __tablename__ = "chat_conversations"

    id = Column(Integer, primary_key=True, index=True)
    adm_user_id = Column(
        Integer, ForeignKey("adm_users.id"), nullable=False, index=True
    )
    title = Column(String(255), nullable=True)
    summary = Column(Text, nullable=False, default="", server_default="")
    recent_messages = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

    user = relationship(
        "User",
        back_populates="chat_conversations",
        foreign_keys="[ChatConversations.adm_user_id]",
    )

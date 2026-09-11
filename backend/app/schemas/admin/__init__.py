# Pydantic shapes for the admin domain, mirroring app/models/admin/ file
# for file. app/schemas/__init__.py re-exports all of them, so routes keep
# writing `schemas.UserOut` and never name this package directly.
from app.schemas.admin.menus import MenuOut
from app.schemas.admin.module import ModuleOut
from app.schemas.admin.token import Token
from app.schemas.admin.user import UserCreate, UserLogin, UserOut
from app.schemas.admin.adm_roles_privileges import AdminRolesPrivileges
from app.schemas.admin.adm_settings import AdmSettingsOut
from app.schemas.admin.adm_user_profiles import AdmUserProfilesOut
from app.schemas.admin.adm_notifications import AdmNotificationsOut
from app.schemas.admin.adm_announcements import AdmAnnouncementsOut
from app.schemas.admin.adm_password_history import AdmPasswordHistoryOut
from app.schemas.admin.chat import ChatRequest, ChatMessage, ChatConversationsOut, ConversationSettings

__all__ = [
    "UserCreate",
    "UserLogin",
    "UserOut",
    "Token",
    "ModuleOut",
    "MenuOut",
    "AdminRolesPrivileges",
    "AdmSettingsOut",
    "AdmUserProfilesOut",
    "AdmNotificationsOut",
    "AdmAnnouncementsOut",
    "AdmPasswordHistoryOut",
    "ChatRequest",
    "ChatMessage",
    "ChatConversationsOut",
    "ConversationSettings"
]

# The admin domain's tables -- every adm_* table in the project.
#
# Mirrors the Laravel original's app/Models/AdmModels/ (at
# C:/laragon/www/vram). One file per table; app/models/__init__.py
# re-exports all of them, so routes keep writing `models.User` and never
# name this package directly.
#
# Adding a table here is not enough on its own: it also needs a line in
# app/models/__init__.py, or importing app.models will not register it on
# Base.metadata and alembic's --autogenerate will not see it.
# See docs/MIGRATIONS.md.
from app.models.admin.menus import Menuses
from app.models.admin.module import Modules
from app.models.admin.role import Role
from app.models.admin.user import User
from app.models.admin.adm_roles_privileges import AdminRolesPrivileges
from app.models.admin.adm_settings import Modules as AdmSettings
from app.models.admin.adm_user_profiles import AdmUserProfiles
from app.models.admin.adm_notifications import AdminNotifications
from app.models.admin.adm_announcements import AdminAnnouncements
from app.models.admin.adm_password_history import AdminPasswordHistory
from app.models.admin.chat_conversations import ChatConversations

__all__ = [
        "Role", 
        "User", 
        "Modules", 
        "Menuses", 
        "AdminRolesPrivileges", 
        "AdmSettings", 
        "AdmUserProfiles",
        "AdminNotifications",
        "AdminAnnouncements",
        "AdminPasswordHistory",
        "ChatConversations",
    ]

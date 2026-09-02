# One file per table, all of them under admin/ -- every table in this
# project is an adm_* table, so the admin domain is currently the whole
# domain. A second domain would sit beside it as another subpackage.
#
# Everything is re-exported here so the rest of the app keeps using
# `from app import models` / `models.User`, and so that importing this
# package alone registers every table on Base.metadata (which is what
# alembic's autogenerate diffs against -- see docs/MIGRATIONS.md).
from app.models.admin import (
    AdminMenuses,
    AdminRolesPrivileges,
    Menuses,
    Modules,
    Role,
    User,
)

__all__ = ["Role", "User", "Modules", "Menuses", "AdminMenuses", "AdminRolesPrivileges"]

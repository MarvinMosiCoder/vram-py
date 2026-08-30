# One file per table. Every model is re-exported here so the rest of the
# app keeps using `from app import models` / `models.User`, and so that
# importing this package alone registers every table on `Base.metadata`
# (which is what alembic's autogenerate diffs against -- see
# docs/MIGRATIONS.md).
from app.models.menus import Menuses
from app.models.module import Modules
from app.models.role import Role
from app.models.user import User
from app.models.admin_menus import AdminMenuses

__all__ = ["Role", "User", "Modules", "Menuses", "AdminMenuses"]

from sqlalchemy import select

from app import models
from app.helpers import common_helpers
from app.helpers.generated_module import ModuleController
from app.modules.registry import action, controller


@controller("MenusController")
class MenusController(ModuleController):
    table_name = "adm_menuses"
    primary_key = "id"
    default_sort = "sorting"

    actions = {"view": True, "create": True, "edit": True, "delete": False}

    @action
    def get_index(self):
        if not common_helpers.is_view(self.user, self.module.path):
            common_helpers.deny()

        roles = self.db.query(models.Role).order_by(models.Role.name.asc()).all()
        return {
            "page_title": "Menu Management",
            "roles": [{"value": r.id, "label": r.name} for r in roles],
            "menus": [self._serialize(m) for m in self._top_level(is_active=1)],
            "inactive_menus": [
                self._serialize(m, with_children=False)
                for m in self._top_level(is_active=0)
            ],
        }

    def _top_level(self, is_active):
        return (
            self.db.query(models.Menuses)
            .filter(
                models.Menuses.parent_id.is_(None),
                models.Menuses.is_active == is_active,
                models.Menuses.is_dashboard == 0,
            )
            .order_by(models.Menuses.sorting.asc())
            .all()
        )

    def _serialize(self, menu, with_children=True):
        data = {
            "id": menu.id,
            "name": menu.name,
            "type": menu.type,
            "path": menu.path,
            "slug": menu.slug,
            "icon": menu.icon,
            "sorting": menu.sorting,
            "is_active": menu.is_active,
            "roles": self._roles_of(menu.id),
        }
        if with_children:
            children = (
                self.db.query(models.Menuses)
                .filter(
                    models.Menuses.parent_id == menu.id,
                    models.Menuses.is_active == 1,
                )
                .order_by(models.Menuses.sorting.asc())
                .all()
            )
            # One level only, matching CommonHelpers::sidebarMenu().
            data["children"] = [self._serialize(c, with_children=False) for c in children]
        return data

    def _roles_of(self, menu_id):
        stmt = (
            select(models.Role.id, models.Role.name)
            .join(models.MenusRoles, models.MenusRoles.id_adm_role == models.Role.id)
            .where(models.MenusRoles.id_adm_menus == menu_id)
            .order_by(models.Role.name.asc())
        )
        return [{"id": row.id, "name": row.name} for row in self.db.execute(stmt)]

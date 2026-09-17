from sqlalchemy import select
from fastapi import HTTPException
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
            "is_dashboard": menu.is_dashboard,
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

    @action
    def post_move(self):
        if not common_helpers.is_update(self.user, self.module.path):
            common_helpers.deny()

        menu_id = self.body.get("menu_id")
        parent_id = self.body.get("parent_id")
        ids = self.body.get("ids")

        if type(menu_id) is not int:
            raise HTTPException(422, "menu_id must be an integer.")

        if parent_id is not None and type(parent_id) is not int:
            raise HTTPException(422, "parent_id must be an integer or null.")

        if (
            not isinstance(ids, list)
            or not ids
            or any(type(value) is not int for value in ids)
        ):
            raise HTTPException(422, "ids must be a non-empty list of integers.")

        if len(ids) != len(set(ids)):
            raise HTTPException(422, "Duplicate menu IDs.")

        moved = (
            self.db.query(models.Menuses)
            .filter(models.Menuses.id == menu_id)
            .first()
        )

        if moved is None:
            raise HTTPException(404, "Menu not found.")

        if moved.is_active != 1 or moved.is_dashboard != 0:
            raise HTTPException(422, "This menu cannot be moved.")

        if parent_id == menu_id:
            raise HTTPException(422, "A menu cannot be its own parent.")

        if parent_id is not None:
            parent = (
                self.db.query(models.Menuses)
                .filter(models.Menuses.id == parent_id)
                .first()
            )

            if (
                parent is None
                or parent.parent_id is not None
                or parent.is_active != 1
                or parent.is_dashboard != 0
            ):
                raise HTTPException(422, "Choose an active top-level parent.")

            # Include inactive children: they would become grandchildren too.
            has_children = (
                self.db.query(models.Menuses.id)
                .filter(models.Menuses.parent_id == menu_id)
                .first()
            )

            if has_children:
                raise HTTPException(
                    422,
                    "Move this menu's children first before nesting it.",
                )

        def siblings(group_parent_id):
            query = self.db.query(models.Menuses).filter(
                models.Menuses.is_active == 1
            )

            if group_parent_id is None:
                query = query.filter(
                    models.Menuses.parent_id.is_(None),
                    models.Menuses.is_dashboard == 0,
                )
            else:
                query = query.filter(
                    models.Menuses.parent_id == group_parent_id
                )

            return query.order_by(
                models.Menuses.sorting.asc(),
                models.Menuses.id.asc(),
            ).all()

        old_parent_id = moved.parent_id
        destination = siblings(parent_id)

        expected_ids = {menu.id for menu in destination}
        expected_ids.add(menu_id)

        if set(ids) != expected_ids:
            raise HTTPException(
                422,
                "Menu list changed. Refresh and try again.",
            )

        remaining = []
        if old_parent_id != parent_id:
            remaining = [
                menu
                for menu in siblings(old_parent_id)
                if menu.id != menu_id
            ]

        # All validation and reads are complete before changing records.
        moved.parent_id = parent_id

        by_id = {menu.id: menu for menu in destination}
        by_id[menu_id] = moved

        for position, current_id in enumerate(ids, start=1):
            by_id[current_id].sorting = position

        for position, menu in enumerate(remaining, start=1):
            menu.sorting = position

        self.db.commit()

        return {"message": "Menu moved.", "status": "success"}

    @action
    def get_roles(self):
        stmt = (
            select(models.Role.id, models.Role.name)
            .order_by(models.Role.name.asc())
        )
        return [
            {"value": row.id, "label": row.name}
            for row in self.db.execute(stmt)
        ]

    @action
    def post_update(self):
        if not common_helpers.is_update(self.user, self.module.path):
            common_helpers.deny()

        menu_id = self.body.get("id")
        roles = self.body.get("roles", [])
        menu_update = self.body

        menu = self.db.query(models.Menuses).get(menu_id)
        if not menu:
            raise HTTPException(
                422,
                "Mune not found!",
            )
         # Update menu fields
        for key, value in self.body.items():
            if key not in {"id", "roles"} and hasattr(menu, key):
                setattr(menu, key, value)
    
        role_ids = [r["id"] for r in roles]
      
        # Get all current menu-role relationships
        menu_roles = self.db.query(models.MenusRoles).filter(
            models.MenusRoles.id_adm_menus == menu_id
        ).all()
        existing_role_ids = { menu_role.id_adm_role for menu_role in menu_roles }

        new_role_ids = set(role_ids)

        for role_id in new_role_ids - existing_role_ids:
            self.db.add(
                models.MenusRoles(
                    id_adm_menus=menu_id,
                    id_adm_role=role_id
                )
            )

        # Remove unchecked roles
        for menu_role in menu_roles:
            if menu_role.id_adm_role not in new_role_ids:
                self.db.delete(menu_role)

        self.db.commit()
        
        return {
            "message": "Menu updated.",
            "status": "success",
            "menu": menu,
        }

    @action
    def post_add(self):
        if not common_helpers.is_create(self.user, self.module.path):
            common_helpers.deny()

        menu_name = self.body.get("name")
        roles = self.body.get("roles",[])
        menu = (self.db.query(models.Menuses).filter(
               models.Menuses.name == menu_name 
                ).first()
        )
        if menu:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Menu already exists.",
                    "status": "error",
                },
            )
        
        # Create menu
        try:
            add_menu = models.Menuses(
                name=self.body.get("name"),
                type=self.body.get("type"),
                path=self.body.get("path"),
                slug=self.body.get("slug"),
                icon=self.body.get("icon"),
                is_active=self.body.get("is_active", 1),
                is_dashboard=0,
                id_adm_role=1
            )

            self.db.add(add_menu)

            # Get generated menu ID before commit
            self.db.flush()

            for role in roles:
                self.db.add(
                    models.MenusRoles(
                        id_adm_menus=add_menu.id,
                        id_adm_role=role["id"],
                    )
                )

            self.db.commit()
            self.db.refresh(add_menu)

            return {
                "message": "Menu added!",
                "status": "success",
                "menu": add_menu,
            }

        except Exception as e:
            self.db.rollback()

            raise HTTPException(
                status_code=500,
                detail={
                    "message": str(e),
                    "status": "error",
                }
            )
     

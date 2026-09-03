from fastapi import HTTPException
from sqlalchemy import func, select

from app import models
from app.helpers import common_helpers
from app.helpers.generated_module import ModuleController
from app.modules.registry import action, controller


@controller("RolesController")
class RolesController(ModuleController):
    table_name = "adm_roles"
    primary_key = "id"
    default_sort = "id"
    search_columns = ["name"]
    has_created_at = True
    has_updated_at = True

    table_fields = {
        "id": {"label": "ID"},
        "name": {"label": "Role"},
        "is_superadmin": {"label": "Superadmin"},
        "theme_color": {"label": "Theme"},
    }

    form_fields = {
        "name": {"label": "Role", "type": "text", "required": True, "max": 255},
        "is_superadmin": {"label": "Superadmin", "type": "checkbox"},
        "theme_color": {"label": "Theme", "type": "text", "max": 255},
    }

    index_buttons = {
        "add": False,
        "export": True,
        "refresh": True,
        "bulk": False,
    }

    custom_index_buttons = [
        {
            "label": "Add Role",
            "action": "add",
            "icon": "plus",
            "url": "/roles/add",
        }
    ]

    actions = {
        "view": True,
        "create": True,
        "edit": True,
        "delete": False,  # Only superadmins can delete roles
        "manage_permissions": True,  # Custom action for managing permissions
    }

    use_edit_route = True

    def validate(self, data):
        data = super().validate(data)
        name = (data.get("name") or "").strip()
        clash = select(self.table.c[self.primary_key]).where(
            func.lower(self.table.c.name) == name.lower()
        )
        current_id = self.body.get(self.primary_key)
        if current_id is not None:
            clash = clash.where(
                self.table.c[self.primary_key] != self.cast_key(current_id)
            )
        if self.db.execute(clash.limit(1)).first():
            raise HTTPException(
                status_code=422, detail={"name": "That role already exists."}
            )
        if data.get("is_superadmin") and not common_helpers.is_superadmin(self.user):
            raise HTTPException(
                status_code=422,
                detail={"is_superadmin": "Only a superadmin can create a superadmin role."},
            )
        return data

    def before_store(self, payload):
        payload["name"] = (payload.get("name") or "").strip()
        color = (payload.get("theme_color") or "").strip().lower()
        if color:
            payload["theme_color"] = color if color.startswith("#") else "#" + color
        return payload

    def after_store(self, payload, record_id):
        # Seed this role's privilege rows / write an audit entry here.
        pass

    @action
    def post_store(self):
        result = super().post_store()
        self._save_permissions(result["id"], self.body.get("permissions"))
        return result

    @action
    def post_update(self):
        result = super().post_update()
        self._save_permissions(self.cast_key(self.record_id()), self.body.get("permissions"))
        return result

    @action
    def get_edit_permissions(self, record_id=None):
        self.require("manage_permissions")
        role = self.find_row(record_id)
        if role is None:
            raise HTTPException(status_code=404, detail="Role not found")
        return {
            "role": role,
            # TODO: real queries. [...] is a list holding Ellipsis, which
            # FastAPI cannot serialise -- it 500s before it reaches React.
            "module": [],    # every module a privilege row can cover
            "granted": [],   # what this role already has
        }
    @action
    def post_save_permissions(self):
        self.require("manage_permissions")
        role_id = self.record_id()
        rows = self.body.get("permissions", [])
        # ... your writes via self.db.execute() or similar
        self.db.commit()
        return {"success": True, "message": "Permissions updated successfully."}

    @action
    def get_module(self, role_id=None):
        role_id = int(role_id or 0)
        modules = models.Modules.__table__
        priv = models.AdminRolesPrivileges.__table__

        def flag(column):
            # One correlated subquery per flag -- the DB::raw() lines, except
            # role_id rides as a bound parameter instead of being interpolated
            # into the SQL string.
            return (
                select(priv.c[column])
                .where(priv.c.id_adm_modules == modules.c.id)
                .where(priv.c.id_adm_roles == role_id)
                .scalar_subquery()
                .label(column)
            )

        flags = ("is_visible", "is_create", "is_read",
                "is_edit", "is_delete", "is_void", "is_override")

        stmt = (
            select(modules, *[flag(c) for c in flags])   # select(modules) == "adm_modules.*"
            .where(modules.c.is_protected == 0)
            .order_by(modules.c.name.asc())
        )
        return [dict(row) for row in self.db.execute(stmt).mappings().all()]

    def _save_permissions(self, role_id, permissions):
        flag_names = ("is_visible", "is_create", "is_read", "is_edit", "is_delete", "is_void", "is_override")

        for module_id, flag_values in (permissions or {}).items():
            flags = {f: int(bool((flag_values or {}).get(f))) for f in flag_names}

            row = (
                self.db.query(models.AdminRolesPrivileges)
                .filter_by(id_adm_modules=int(module_id), id_adm_roles=role_id)
                .first()
            )
            if row:
                for key, value in flags.items():
                    setattr(row, key, value)          # tracked -- no explicit save()
            else:
                self.db.add(models.AdminRolesPrivileges(
                    id_adm_roles=role_id, id_adm_modules=int(module_id), **flags
                ))
        self.db.commit()


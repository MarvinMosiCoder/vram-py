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
        "edit": False,
        "delete": False,  # Only superadmins can delete roles
        "manage_permissions": True,  # Custom action for managing permissions
    }

    custom_row_actions = [
        {
            "label": "Manage Permissions",
            "action": "manage_permissions",
            "icon": "pencil",
            "url": "/roles/edit-permissions/{id}",
        }
    ]

    def validate(self, data):
        """Rung 2. super() first, so `required` and `max` from form_fields
        still apply -- this only adds what a config dict cannot express."""
        data = super().validate(data)

        # Case-insensitive: "Admin" and "admin" being two different roles
        # is a support ticket waiting to happen.
        name = (data.get("name") or "").strip()
        clash = select(self.table.c[self.primary_key]).where(
            func.lower(self.table.c.name) == name.lower()
        )
        # validate() serves BOTH create and update -- post_update() calls it
        # too. On update the body carries the primary key, and without this
        # exclusion a role would collide with itself and could never be
        # saved under its own name.
        current_id = self.body.get(self.primary_key)
        if current_id is not None:
            clash = clash.where(
                self.table.c[self.primary_key] != self.cast_key(current_id)
            )
        if self.db.execute(clash.limit(1)).first():
            # detail MUST be a {field: message} dict. That is the shape
            # GeneratedModulePage's errorsFrom() and add.jsx both read to
            # light up the offending input; a plain string only ever
            # reaches a toast.
            raise HTTPException(
                status_code=422, detail={"name": "That role already exists."}
            )

        # Privilege escalation is not something a form config can guard,
        # so the rule lives here rather than in form_fields.
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
        common_helpers.dd(self.body)
        result["redirect"] = "/roles/edit-permissions/%s" % result["id"]
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
            .where(modules.c.deleted_at.is_(None))
            .order_by(modules.c.name.asc())
        )
        return [dict(row) for row in self.db.execute(stmt).mappings().all()]

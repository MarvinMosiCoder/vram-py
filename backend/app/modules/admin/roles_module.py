from app.helpers.generated_module import ModuleController
from app.modules.registry import controller


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

    # A key that is absent is OFF -- is_capable() has no default-true
    # fallback, so "view" and "create" have to be declared to exist.
    actions = {
        "view": True,
        "create": True,
        "edit": False,
        "delete": False,  # Only superadmins can delete roles
    }
    # A static list, not a function of the row: the React runtime expands
    # {id} in `url` per row and applies `visibleWhen` itself.
    custom_row_actions = [
        {
            "label": "Manage Permissions",
            "action": "edit",
            "icon": "lock",
            "url": "/admin/roles/{id}/edit-permissions",
        }
    ]

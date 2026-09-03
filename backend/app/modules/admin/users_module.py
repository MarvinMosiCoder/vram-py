from app.helpers.generated_module import ModuleController
from app.modules.registry import action, controller
from app.helpers import common_helpers

@controller("UsersController")
class UsersController(ModuleController):
    table_name = "adm_users"
    primary_key = "id"
    default_sort = "id"
    search_columns = ["name", "email"]
    has_created_at = True
    has_updated_at = True

    table_fields = {
        "id": {"label": "ID"},
        "name": {"label": "Name"},
        "email": {"label": "Email"},
        "role_name": {
            "label": "Role",
            "select": "adm_roles.name",
            "join": {
                "table": "adm_roles",
                "first": "adm_users.id_adm_role",
                "second": "adm_roles.id",
            },
        },
    }

    form_fields = {
        "name": {"label": "Name", "type": "text", "max": 255},
        "email": {"label": "Email", "type": "text", "max": 255},
        "id_adm_role": {
            "label": "Role",
            "type": "select",
            "table": "adm_roles",
            "value_field": "id",
            "display_field": "name",
        },
        "password": {"label": "Password", "type": "password", "max": 255},
    }

    actions = {"view": True, "create": True, "edit": True}
    bulk_actions = True



 
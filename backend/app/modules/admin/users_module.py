from app.helpers.generated_module import ModuleController
from app.modules.registry import action, controller
from app.core import auth
from app import models
from app.helpers import common_helpers
from fastapi import HTTPException
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
            "type": "react-select",
            "table": "adm_roles",
            "value_field": "id",
            "display_field": "name",
        },
        "password": {"label": "Password", "type": "password", "max": 255},
    }

    actions = {"view": True, "create": True, "edit": True}
    bulk_actions = True
    use_add_route = True
    use_edit_route = True

    @action
    def post_store(self):
        return self._save_users(self.body)

    @action
    def post_update(self):
        return self._save_users(self.body, is_update=True)

    def _save_users(self, data, is_update=False):
        # Validate required fields
        required_fields = ["name", "email", "id_adm_role"]
        for field in required_fields:
            if not data.get(field):
                raise HTTPException(status_code=400, detail=f"{field} is required.")

        # Check if email is unique
        existing_user = self.db.query(models.User).filter_by(email=data["email"]).first()
        if existing_user and (not is_update or existing_user.id != int(data.get("id"))):
            raise HTTPException(status_code=400, detail="Email must be unique.")

        # Hash password if provided
        if data.get("password"):
            data["password"] = auth.hash_password(data["password"])

        # Save or update user
        if is_update:
            user = self.db.query(models.User).get(data["id"])
            for key, value in data.items():
                setattr(user, key, value)
            self.db.commit()
            return user
        else:
            new_user = models.User(**data)
            self.db.add(new_user)
            self.db.commit()
            return new_user



 
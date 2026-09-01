from app.helpers.generated_module import ModuleController
from app.modules.registry import action, controller


@controller("UsersController")
class UsersController(ModuleController):

    @action
    def get_index(self):
        return {
            "module": self.module.name,
            "table": self.module.table_name,
            "viewer": self.user.email,
        }

    @action
    def get_edit(self, record_id):
        return {"editing": record_id}

    @action
    def post_bulk_action(self):
        return {"ok": True}

    def not_reachable(self):
        # No @action -- returns 404 even though the method exists.
        return {"leaked": True}

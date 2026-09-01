from fastapi import HTTPException
from sqlalchemy import func, select

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

    # A key that is absent is OFF -- is_capable() has no default-true
    # fallback, so "view" and "create" have to be declared to exist.
    actions = {
        "view": True,
        "create": True,
        "edit": False,
        "delete": False,  # Only superadmins can delete roles
        "manage_permissions": True,  # Custom action for managing permissions
    }
    # A static list, not a function of the row: the React runtime expands
    # {id} in `url` per row and applies `visibleWhen` itself.
    #
    # The url MUST be /<module_path>/<action>/<args...> -- the one shape
    # dynamic.py dispatches and ModuleRoute.jsx resolves. That single
    # string names the route, the page file
    # (frontend/src/pages/modules/roles/edit-permissions.jsx) and the
    # method below, so none of the three has to be registered anywhere.
    custom_row_actions = [
        {
            "label": "Manage Permissions",
            "action": "manage_permissions",
            "icon": "pencil",
            "url": "/roles/edit-permissions/{id}",
        }
    ]
    # --- Create: this module owns it -----------------------------------
    #
    # THE LADDER. ModuleController's inherited add is enough for a plain
    # column-per-field insert. Roles is not, so it escalates one rung at a
    # time. Each rung is independent -- a new module takes only what it
    # needs, and inherits the rest:
    #
    #   validate()      business rules a form_fields dict cannot state
    #   before_store()  shape the payload on its way into the INSERT
    #   after_store()   side effects, once the row has an id
    #   post_store()    own the write, or the response, entirely
    #
    # These apply to EVERY create path at once -- the runtime's built-in
    # panel, /roles/add, and the custom page at
    # frontend/src/pages/modules/roles/add.jsx -- because all three POST to
    # /roles/store. That is the whole reason to override here instead of
    # writing a second endpoint for the custom page: two endpoints drift,
    # one does not.

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
        """Rung 1. Runs between payload() and the INSERT. MUST return the
        payload -- a bare mutation is silently dropped."""
        payload["name"] = (payload.get("name") or "").strip()
        # add.jsx's colour input emits "#RRGGBB", but the text field beside
        # it lets someone type "3b82f6". Normalise once here so the column
        # never holds both spellings of the same colour.
        color = (payload.get("theme_color") or "").strip().lower()
        if color:
            payload["theme_color"] = color if color.startswith("#") else "#" + color
        return payload

    def after_store(self, payload, record_id):
        """Rung 1. The row exists and has an id. post_store() has already
        committed, so anything written here needs a commit of its own."""
        # Seed this role's privilege rows / write an audit entry here.
        pass

    @action
    def post_store(self):
        """Rung 3 -- POST /roles/store.

        RE-APPLY @action ON EVERY OVERRIDE. dynamic.py dispatches only on
        methods carrying __module_action__, and this is a new function
        object, so the base class's decorator does NOT carry over. Leave it
        off and the endpoint 404s -- which reads like a missing route
        rather than a missing decorator.

        Delegating to super() rather than re-typing the insert: the base
        already runs validate() -> payload() -> before_store() -> stamps ->
        RETURNING id -> after_store(), and every one of those picks up the
        overrides above. Copying its body here would only create a second
        thing to keep in sync. Re-type the INSERT only when the write
        itself must differ -- a second table, a transaction spanning both.
        """
        result = super().post_store()
        # A brand new role has no permissions, so the matrix is the only
        # useful next screen. The base response shape is fixed, and that is
        # what makes this override earn its place.
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

    

"""Python counterpart of the generator half of Laravel's
app/Http/Controllers/Admin/ModulsController.php (at C:/laragon/www/vram).

Lives beside the controllers it writes, the way ModulsController lives in
Controllers/Admin/ beside the controllers it generates.

Same idea, same order of operations:

    1. check the table exists
    2. introspect it -- columns, types, nullability, defaults, primary key
    3. write a controller file with that metadata as editable literals
    4. insert the adm_modules row

That is why "GeneratedModuleController" is called generated: upstream a
module is a FILE the app writes for you, not a row full of configuration.
adm_modules stays the seven columns it has always had.

The one structural difference: Laravel also generates a per-module .jsx,
because Inertia resolves a controller's $viewName to a component. Nothing
to generate here -- ModuleRoute falls back to the shared
GeneratedModulePage, so a new module is browsable with no frontend file at
all. See docs/MODULES.md.

Introspection is easier here than upstream. Laravel runs SHOW COLUMNS and
parses strings like "varchar(255)"; SQLAlchemy already holds the typed
metadata, so build_meta() reads Base.metadata.tables[...] directly.
"""
import os
import re

from sqlalchemy import Boolean, Date, DateTime, Integer, Numeric, String, Text, Time

from app.core.database import Base

# Where generated controllers land -- this file's own folder.
# registry.discover() scans it, so writing a file here is all it takes to
# register the module. discover() imports only *_module.py, which is why
# this file can sit beside the controllers without being mistaken for one.
MODULES_DIR = os.path.dirname(os.path.abspath(__file__))

# Two lists, because "keep it out of the form" and "never show it at all"
# are different problems.
#
# HIDDEN never appears anywhere -- not a column, not a form field, not
# searchable. Laravel's generator has no equivalent: its $systemColumns only
# filters the FORM, so pointing it at a users table emits a module whose list
# view renders the bcrypt hash. Since the whole value of generating a file is
# that only declared columns are ever selected, the declaration must not start
# out wrong.
HIDDEN_COLUMNS = {
    "password", "remember_token", "token_version",
    "email_verified_at", "deleted_at",
}

# Laravel's $systemColumns: bookkeeping you would not type into a form, but
# which is often worth seeing in a list. created_at / updated_at stay as
# columns for that reason -- delete the two lines if you do not want them.
SYSTEM_COLUMNS = HIDDEN_COLUMNS | {
    "created_at", "updated_at",
    "created_by", "updated_by", "deleted_by",
}

# Same shape as Laravel's validation on postAddSave().
TABLE_RE = re.compile(r"^[A-Za-z0-9_]+$")
PATH_RE = re.compile(r"^[a-z0-9_-]+$")     # tighter than upstream: must also
                                           # satisfy dynamic.py's MODULE_PATH_RE
NAME_RE = re.compile(r"^[A-Za-z0-9 _-]+$")


class GeneratorError(Exception):
    """Anything that should stop generation with a readable message."""


# --- Introspection: Laravel's buildModuleMeta() -----------------------
def _field_type(column):
    """columnFieldType(). Upstream matches on a MySQL type string; the
    SQLAlchemy type object says the same thing without the parsing."""
    t = column.type
    if getattr(t, "enums", None):
        return "select"
    if isinstance(t, Boolean):
        return "checkbox"
    if isinstance(t, Text):
        return "textarea"
    if isinstance(t, (Integer, Numeric)):
        return "number"
    if isinstance(t, DateTime):
        return "datetime-local"
    if isinstance(t, Date):
        return "date"
    if isinstance(t, Time):
        return "time"
    return "text"


def _label(column_name):
    """"id_adm_role" -> "Id Adm Role". Upstream uses Str::headline()."""
    return column_name.replace("_", " ").strip().title()


def build_meta(table_name):
    """Everything a controller needs, derived from the table itself.

    Mirrors buildModuleMeta(): pick the primary key, drop system columns
    from the form, and infer a field type and validation rules per column.
    """
    if table_name not in Base.metadata.tables:
        raise GeneratorError(
            "Table '%s' is not registered on Base.metadata. Add a model for "
            "it under app/models/admin/ first." % table_name
        )
    table = Base.metadata.tables[table_name]

    pk = list(table.primary_key.columns)
    primary_key = pk[0].name if pk else "id"

    table_fields, form_fields, search_columns = {}, {}, []
    for column in table.columns:
        name = column.name
        if name in HIDDEN_COLUMNS:
            continue
        table_fields[name] = {"label": _label(name)}

        if name == primary_key or name in SYSTEM_COLUMNS:
            continue

        config = {"label": _label(name), "type": _field_type(column)}
        # columnValidationRule(): required unless nullable or defaulted.
        if not column.nullable and column.default is None and column.server_default is None:
            config["required"] = True
        length = getattr(column.type, "length", None)
        if isinstance(column.type, String) and length:
            config["max"] = length
        if getattr(column.type, "enums", None):
            config["options"] = list(column.type.enums)
        form_fields[name] = config

        # Free-text columns are the ones worth searching.
        if isinstance(column.type, (String, Text)) and not isinstance(column.type, Text):
            search_columns.append(name)

    return {
        "primary_key": primary_key,
        "table_fields": table_fields,
        "form_fields": form_fields,
        "search_columns": search_columns,
        "has_created_at": "created_at" in table.c,
        "has_updated_at": "updated_at" in table.c,
    }


# --- Rendering: Laravel's controllerContent() -------------------------
def _literal(value, indent=8):
    """Render a dict/list as readable Python source. Upstream's phpArray()."""
    pad = " " * indent
    if isinstance(value, dict):
        if not value:
            return "{}"
        inner = "".join(
            "%s%r: %s,\n" % (pad, k, _literal(v, indent + 4)) for k, v in value.items()
        )
        return "{\n%s%s}" % (inner, " " * (indent - 4))
    if isinstance(value, list):
        return repr(value)
    return repr(value)


TEMPLATE = '''"""{name} module -- generated by module_generator.py on {date}.

Edit this file freely. It is ordinary code: the metadata below was inferred
from `{table_name}`, and everything else comes from ModuleController.

  table_fields   the list view's columns, in this order
  form_fields    the create/edit form, plus its validation rules
  search_columns the allowlist for ?search=

The create/update seams are stubbed at the bottom of this file. Other
hooks available to override: custom_index_query, index_row, before_update,
after_update, before_delete, after_delete, handle_custom_bulk_action.
See docs/MODULES.md.
"""
from app.helpers.generated_module import ModuleController
from app.modules.registry import controller


@controller("{controller_name}")
class {controller_name}(ModuleController):
    table_name = {table_name!r}
    primary_key = {primary_key!r}
    default_sort = {primary_key!r}
    search_columns = {search_columns}
    has_created_at = {has_created_at}
    has_updated_at = {has_updated_at}

    table_fields = {table_fields}

    form_fields = {form_fields}

    actions = {{"view": True, "create": True, "edit": True, "delete": True}}

    # --- Create and update: the ladder ---------------------------------
    #
    # Everything below is INERT as generated -- each rung does exactly what
    # ModuleController already does. They are here as labelled seams, so a
    # module with real logic has an obvious place to put it instead of
    # having to read the base class to find one. Delete any rung you do not
    # use; keeping an inert one costs nothing but noise.
    #
    # Every rung applies to EVERY write path at once -- the runtime's
    # built-in panel, /{path}/add, and any custom page under
    # frontend/src/pages/modules/{path}/ -- because all three POST to
    # /{path}/store. That is the reason to override here rather than to
    # write a second endpoint for a custom page: two write paths drift,
    # one does not.

    def validate(self, data):
        """Rung 2 -- business rules a form_fields dict cannot state.

        super() first, so `required` and `max` from form_fields still
        apply. Raise HTTPException(422, detail={{"column": "message"}}) to
        reject: a {{field: message}} DICT is what the React runtime reads to
        light up the offending input, while a plain string only ever
        reaches a toast.

        Called by BOTH post_store and post_update. On update self.body
        carries the primary key, so exclude the current row from any
        uniqueness check -- otherwise a record collides with itself and can
        never be saved under its own value:

            current_id = self.body.get(self.primary_key)
            if current_id is not None:
                stmt = stmt.where(
                    self.table.c[self.primary_key] != self.cast_key(current_id)
                )
        """
        return super().validate(data)

    def before_store(self, payload):
        """Rung 1 -- shape the payload on its way into the INSERT.

        MUST return the payload; a bare mutation is silently dropped. Runs
        AFTER payload(), which keeps only declared form columns and drops
        None -- so a key added here bypasses that filter, and a column you
        need to write as NULL has to be handled by overriding payload().
        """
        return payload

    def after_store(self, payload, record_id):
        """Rung 1 -- side effects, once the row has an id.

        post_store() has already committed by the time this runs, so
        anything written here needs a commit of its own.
        """
        pass

    # Rung 3 -- own the write, or the response, entirely.
    # Uncommenting this needs `action` on the registry import at the top:
    #     from app.modules.registry import action, controller
    #
    # RE-APPLY @action ON EVERY OVERRIDE OF AN INHERITED ACTION. dynamic.py
    # dispatches only on methods carrying __module_action__, and an override
    # is a NEW function object, so the base class's decorator does not carry
    # over. Leave it off and the endpoint 404s -- which reads like a missing
    # route rather than a missing decorator.
    #
    # Delegate to super() unless the write itself must differ (a second
    # table, a transaction spanning both). The base already runs validate()
    # -> payload() -> before_store() -> stamps -> RETURNING id ->
    # after_store(), and each of those picks up the overrides above, so
    # re-typing the INSERT only creates a second thing to keep in sync.
    #
    # @action
    # def post_store(self):
    #     result = super().post_store()
    #     result["redirect"] = "/{path}/edit/%s" % result["id"]
    #     return result
'''


def render_controller(controller_name, table_name, meta, name, date, path):
    # `path` is interpolated into the generated comments so they name the
    # module's real URLs (/roles/store) instead of a placeholder nobody can
    # copy-paste.
    return TEMPLATE.format(
        name=name,
        date=date,
        path=path,
        controller_name=controller_name,
        table_name=table_name,
        primary_key=meta["primary_key"],
        search_columns=_literal(meta["search_columns"]),
        has_created_at=meta["has_created_at"],
        has_updated_at=meta["has_updated_at"],
        table_fields=_literal(meta["table_fields"]),
        form_fields=_literal(meta["form_fields"]),
    )


# --- Generation: Laravel's postAddSave() ------------------------------
def controller_name_for(name):
    """"Menu Management" -> "MenuManagementController". Str::studly()."""
    studly = "".join(part.capitalize() for part in re.split(r"[\s_-]+", name) if part)
    return studly + "Controller"


def file_name_for(name):
    """"Menu Management" -> "menu_management_module.py"."""
    snake = re.sub(r"[\s-]+", "_", name.strip()).lower()
    snake = re.sub(r"[^a-z0-9_]", "", snake)
    return "%s_module.py" % snake


def generate(db, name, path, table_name, icon="fa fa-circle", overwrite=False):
    """Write the controller file and insert the adm_modules row.

    Returns (file_path, controller_name). Raises GeneratorError on anything
    the caller should see as a validation failure -- the same conditions
    postAddSave() returns 422 for.
    """
    from datetime import datetime

    from app import models

    if not NAME_RE.match(name or ""):
        raise GeneratorError("Name must be letters, numbers, spaces, _ or -.")
    if not PATH_RE.match(path or ""):
        raise GeneratorError(
            "Path must match ^[a-z0-9_-]+$ -- dynamic.py rejects anything else "
            "before it reaches a query."
        )
    if not TABLE_RE.match(table_name or ""):
        raise GeneratorError("Table name must be letters, numbers or underscores.")

    meta = build_meta(table_name)
    controller_name = controller_name_for(name)
    file_path = os.path.join(MODULES_DIR, file_name_for(name))

    if os.path.exists(file_path) and not overwrite:
        raise GeneratorError("%s already exists. Pass overwrite to replace it."
                             % os.path.basename(file_path))
    if db.query(models.Modules).filter(models.Modules.path == path).first():
        raise GeneratorError("A module already uses the path '%s'." % path)

    source = render_controller(controller_name, table_name, meta, name,
                               datetime.now().strftime("%Y-%m-%d"), path)
    with open(file_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(source)

    db.add(models.Modules(
        name=name, icon=icon, path=path, table_name=table_name,
        controller=controller_name, is_active=1, is_protected=0,
    ))
    db.commit()
    return file_path, controller_name

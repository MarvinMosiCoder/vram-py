"""Python equivalent of Laravel's app/Helpers/GeneratedModuleController.php
(at C:/laragon/www/vram -- the file this is a port of).

A module declares metadata; this base class turns it into a query, a
paginated response, and validated create/update/delete. Every @action
here is inherited, so a subclass gets the whole CRUD surface for free.

Where the original builds SQL out of strings (DB::table($name)->join(...)),
this resolves every table and column through Base.metadata first. A bad
name is a 500 here rather than arbitrary SQL later, and it is why the join
support below takes "adm_roles.name" and hands back a Column object instead
of pasting the text into a query.
"""
import csv
import io
import re

from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import Table, asc, desc, func, or_, select

from app.core.database import Base
from app.helpers import common_helpers
from app.modules.registry import action

# Same shape Laravel validates bulkAction against: a plain identifier, so a
# custom action's value can never carry anything that reads as SQL or a path.
BULK_ACTION_RE = re.compile(r"^[A-Za-z0-9_-]+$")

# A status badge falls back to these when the joined row has no colour, or
# has one that is not a #RRGGBB literal. Straight from globalRowIndex().
BADGE_BACKGROUND = "#E5E7EB"
BADGE_TEXT = "#374151"
BADGE_CLASS = "status-badge"
HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


class ModuleController:
    # --- Configuration: override in a subclass ------------------------
    table_name = None                 # falls back to adm_modules.table_name
    primary_key = "id"
    table_fields = {}                 # list view:  {"name": {"label": "Role"}}
    form_fields = {}                  # create/edit metadata + validation
    search_columns = []               # allowlist for ?search=
    default_sort = None
    per_page = 15
    has_created_at = False
    has_updated_at = False
    actions = {"view": True, "create": True, "edit": True, "delete": True}
    custom_row_actions = []           # row buttons: [{"label", "icon", "url"}]
    custom_index_buttons = []         # toolbar buttons: [{"label", "action"}]
    custom_bulk_actions = []          # [{"label", "value"}] -- see handle_custom_bulk_action()
    bulk_actions = True               # False switches the whole toolbar off
    index_buttons = {"add": True, "export": True, "refresh": True, "bulk": True}
    use_add_route = False             # True -> "New" navigates to /<path>/add
    use_edit_route = False            # True -> edit navigates to /<path>/edit/<id>

    def __init__(self, module, db, user, request, body=None):
        self.module = module
        self.db = db
        self.user = user
        self.request = request
        self.body = body or {}

        # Laravel's DB::table() accepts any string. Resolving through
        # Base.metadata instead means a bad adm_modules.table_name is a
        # 500 here, not arbitrary SQL later.
        name = self.table_name or module.table_name
        if name not in Base.metadata.tables:
            raise HTTPException(
                status_code=500,
                detail=f"Module '{module.path}' names unknown table '{name}'",
            )
        self.table_name = name
        self.table: Table = Base.metadata.tables[name]

        # normalizeFieldConfiguration() -- derive the flat lists once.
        self.column_labels = {k: v.get("label", k) for k, v in self.table_fields.items()}
        self.form_columns = [c for c in self.form_fields if c in self.table.c]
        self.resolve_fields()
        self.columns = list(self.selected)

    # --- Field resolution: joins, aliases, status badges ---------------
    def resolve_fields(self):
        """normalizeFieldConfiguration() plus indexQuery()'s join pass.

        A table_field usually names a column on this module's own table.
        It may instead point at another one:

            "role_name": {
                "label": "Role",
                "select": "adm_roles.name",
                "join": {"table": "adm_roles",
                         "first": "adm_users.id_adm_role",
                         "second": "adm_roles.id"},
            }

        Everything downstream -- select list, search, filters, sorting,
        export -- reads self.selected, so a joined alias behaves exactly
        like a local column with no special cases anywhere else.
        """
        self.joins = []          # [(Table, onclause, is_inner)] in declaration order
        self.selected = {}       # alias -> Column, in table_fields order
        self.badge_fields = {}   # alias -> {"background": key, "text": key}
        applied = set()

        for alias, config in self.table_fields.items():
            config = config if isinstance(config, dict) else {"label": config}
            join = config.get("join")
            if join:
                self.apply_join(join, applied)

            source = config.get("select") or config.get("column")
            column = self.resolve_column(source) if source else self.table.c.get(alias)
            if column is None:
                continue                      # declared but not a real column
            self.selected[alias] = column

            if join:
                self.add_badge_columns(alias, join)

    def resolved_form_fields(self):
        """form_fields, with any FK-lookup select's `options` populated from
        the table it names.

        table_fields' `select`/`join` resolve a *display* value pulled from
        another table for the list view; this is the write-side counterpart
        -- a form_fields entry shaped like

            "id_adm_role": {"label": "Role", "type": "select",
                             "table": "adm_roles",
                             "value_field": "id", "display_field": "name"}

        gets its `options` filled with that table's live rows instead of a
        module having to hardcode a snapshot of them. A field that already
        declares `options` (an enum column, from build_meta()) is left
        alone. `type: "react-select"` gets the same resolution as
        `"select"` -- it is the same FK-lookup field, styled differently by
        the frontend; see users_module.py's `id_adm_role`. Computed
        per-request, off a fresh dict, so the class-level form_fields
        (shared by every request) is never mutated in place.
        """
        resolved = {}
        for name, config in self.form_fields.items():
            config = dict(config) if isinstance(config, dict) else {"label": config}
            table_name = config.get("table")
            if config.get("type") in ("select", "react-select") and table_name and "options" not in config:
                table = Base.metadata.tables.get(table_name)
                value_field = config.get("value_field", "id")
                display_field = config.get("display_field", "name")
                if table is not None and value_field in table.c and display_field in table.c:
                    rows = self.db.execute(
                        select(table.c[value_field], table.c[display_field])
                        .order_by(table.c[display_field])
                    ).all()
                    config["options"] = [{"value": v, "label": d} for v, d in rows]
            resolved[name] = config
        return resolved

    def resolve_column(self, reference):
        """"adm_roles.name" -> that Column. A bare name means this table.

        Resolved through Base.metadata rather than concatenated into SQL,
        so an unknown table or column is a loud 500 instead of a query the
        database rejects halfway through a request.
        """
        if not reference:
            return None
        if "." not in reference:
            return self.table.c.get(reference)
        table_name, _, column_name = reference.partition(".")
        table = Base.metadata.tables.get(table_name)
        if table is None or column_name not in table.c:
            raise HTTPException(
                status_code=500,
                detail=f"Module '{self.module.path}' references unknown column '{reference}'",
            )
        return table.c[column_name]

    def apply_join(self, join, applied):
        """applyTableFieldJoin(). Deduplicated the same way it is upstream:
        the same join declared on three fields still produces one JOIN."""
        table_name = join.get("table")
        first = join.get("first") or join.get("local")
        second = join.get("second") or join.get("foreign")
        if not (table_name and first and second):
            return

        kind = str(join.get("type", "left")).lower()
        key = (kind, table_name, first, second)
        if key in applied:
            return
        applied.add(key)

        table = Base.metadata.tables.get(table_name)
        if table is None:
            raise HTTPException(
                status_code=500,
                detail=f"Module '{self.module.path}' joins unknown table '{table_name}'",
            )
        onclause = self.resolve_column(first) == self.resolve_column(second)
        self.joins.append((table, onclause, kind in ("join", "inner")))

    def add_badge_columns(self, alias, join):
        """isStatusesJoin(). Upstream hardcodes the `statuses` table; here
        any joined table carrying badge_background_color and
        badge_text_color turns its column into a coloured badge, which is
        the same feature without the table name baked in."""
        table = Base.metadata.tables.get(join.get("table"))
        if table is None:
            return
        if "badge_background_color" not in table.c or "badge_text_color" not in table.c:
            return
        safe = re.sub(r"[^A-Za-z0-9_]", "_", alias)
        self.badge_fields[alias] = {
            "background": f"__badge_background_{safe}",
            "text": f"__badge_text_{safe}",
        }
        self.selected.setdefault(f"__badge_background_{safe}", table.c["badge_background_color"])
        self.selected.setdefault(f"__badge_text_{safe}", table.c["badge_text_color"])

    # --- Request helpers ---------------------------------------------
    def param(self, key, default=None):
        return self.request.query_params.get(key, default)

    def int_param(self, key, default, maximum=None):
        try:
            value = int(self.request.query_params.get(key, default))
        except (TypeError, ValueError):
            value = default
        value = max(1, value)
        return min(value, maximum) if maximum else value

    # --- Query building ----------------------------------------------
    def index_query(self):
        """Selects only declared columns. Laravel does `table.*` and filters
        at render time, which still pulls password hashes out of the
        database; this never fetches them at all."""
        wanted = {self.primary_key: self.table.c[self.primary_key]}
        wanted.update(self.selected)
        for name in self.form_columns:
            wanted.setdefault(name, self.table.c[name])

        stmt = select(*[column.label(alias) for alias, column in wanted.items()])

        source = self.table
        for table, onclause, is_inner in self.joins:
            source = (source.join(table, onclause) if is_inner
                      else source.outerjoin(table, onclause))
        return stmt.select_from(source)

    def apply_search(self, stmt):
        term = self.param("search")
        if not term or not self.search_columns:
            return stmt
        clauses = [
            self.selected[c].ilike(f"%{term}%")
            for c in self.search_columns
            if c in self.selected
        ]
        return stmt.where(or_(*clauses)) if clauses else stmt

    def apply_filters(self, stmt):
        """Any query param named after a declared column filters on it:
        /roles?name=Super

        The `not in self.selected` skip IS the allowlist -- without it a
        caller could filter on columns the module deliberately hides."""
        for key, value in self.request.query_params.items():
            if key not in self.selected or value == "" or key.startswith("__"):
                continue
            column = self.selected[key]
            try:
                is_text = column.type.python_type is str
            except NotImplementedError:
                is_text = False
            if is_text:
                stmt = stmt.where(column.ilike(f"%{value}%"))
            elif value.lstrip("-").isdigit():
                stmt = stmt.where(column == int(value))
        return stmt

    def sortable_columns(self):
        """sortableColumns(). A field opts out with {"sortable": False}."""
        allowed = {
            alias for alias in self.selected
            if not alias.startswith("__")
            and (self.table_fields.get(alias) or {}).get("sortable", True) is not False
        }
        allowed.update(self.form_columns)
        allowed.add(self.primary_key)
        return allowed

    def order_by(self, stmt):
        requested = self.param("sort_by")
        if requested not in self.sortable_columns():    # sortColumn()'s allowlist
            requested = self.default_sort or self.primary_key
        # Explicit None check: `a or b` calls bool() on a Column, and
        # SQLAlchemy refuses that outright.
        column = self.selected.get(requested)
        if column is None:
            column = self.table.c[requested]
        descending = (self.param("sort_dir") or "asc").lower() == "desc"
        return stmt.order_by(desc(column) if descending else asc(column))

    def paginate(self, stmt):
        page = self.int_param("page", 1)
        per_page = self.int_param("per_page", self.per_page, maximum=100)
        # order_by(None) strips the ORDER BY -- pointless inside a COUNT,
        # and some databases reject it there.
        total = self.db.execute(
            select(func.count()).select_from(stmt.order_by(None).subquery())
        ).scalar_one()
        rows = self.db.execute(
            stmt.limit(per_page).offset((page - 1) * per_page)
        ).mappings().all()
        return {
            "rows": [self.build_row(row) for row in rows],
            "total": total,
            "page": page,
            "per_page": per_page,
            "last_page": max(1, -(-total // per_page)),
        }

    # --- Row presentation ---------------------------------------------
    def build_row(self, row):
        """indexRows()' transform: attach __rowIndex, then run index_row().

        __rowIndex is per-cell presentation -- a label plus a class and an
        inline style -- which the React runtime reads instead of the raw
        value. global_row_index() fills it from joined badge colours;
        row_index() is the module's chance to add its own.
        """
        row = dict(row)
        meta = self.global_row_index(row)
        meta.update(self.row_index(row) or {})

        # The badge colour columns are plumbing. They were selected to build
        # the metadata above and have no business reaching the browser.
        for key in [k for k in row if k.startswith("__badge_")]:
            row.pop(key)

        if meta:
            row["__rowIndex"] = meta
        return self.index_row(row)

    def global_row_index(self, row):
        """globalRowIndex() -- a coloured badge for every joined status."""
        meta = {}
        for alias, keys in self.badge_fields.items():
            background = self.hex_color(row.get(keys["background"]), BADGE_BACKGROUND)
            text = self.hex_color(row.get(keys["text"]), BADGE_TEXT)
            meta[alias] = {
                "label": row.get(alias) or "",
                "className": BADGE_CLASS,
                "style": {"backgroundColor": background, "color": text},
            }
        return meta

    @staticmethod
    def hex_color(value, fallback):
        """isHexColor(). Anything that is not #RRGGBB becomes the fallback,
        so a bad value in the database cannot inject a style."""
        if isinstance(value, str) and HEX_COLOR_RE.match(value):
            return value.upper()
        return fallback

    # --- Response building --------------------------------------------
    def render_index(self, paginated, extra=None):
        """Laravel's renderIndex($rows, $extra) -- the props the React page
        renders from.

        `extra` is merged last, and that is the whole trick behind get_add()
        and get_edit(): each is the index page plus a key or two, so neither
        needs a props builder of its own.
        """
        rows = paginated.pop("rows")
        props = {
            "module": {
                "name": self.module.name,
                "path": self.module.path,
                "icon": self.module.icon,
            },
            "tableName": self.table_name,
            "primaryKey": self.primary_key,
            "columns": [
                {"key": key, "label": config.get("label", key)}
                for key, config in self.table_fields.items()
            ],
            "formFields": self.resolved_form_fields(),
            # permittedActions() upstream: the module's declaration ANDed
            # with the caller's privileges. moduleAccess() is the privilege
            # half on its own -- the React runtime takes both, and until
            # now nothing on the backend produced the second one.
            "actions": common_helpers.permitted_actions(
                self.actions, self.user, self.module.path
            ),
            "customRowActions": list(self.custom_row_actions or []),
            "customIndexButtons": list(self.custom_index_buttons or []),
            "customBulkActions": self.normalized_custom_bulk_actions(),
            "bulkActions": bool(self.bulk_actions),
            "indexButtons": self.resolve_index_buttons(),
            "moduleAccess": common_helpers.module_access(
                self.user, self.module.path
            ),
            "useAddRoute": self.use_add_route,
            "useEditRoute": self.use_edit_route,
            # Always present, so the response shape never changes between
            # the three page modes.
            "pageMode": None,
            "editRow": None,
            "rows": rows,
            "pagination": paginated,
        }
        props.update(extra or {})
        return props

    def resolve_index_buttons(self):
        """indexButtons() -- the module's toolbar config ANDed with access.

        `add` follows the create privilege and `bulk` needs something to do,
        so neither can offer a button whose endpoint would 403.
        """
        access = common_helpers.module_access(self.user, self.module.path)
        declared = dict(self.index_buttons or {})
        buttons = {"add": True, "export": True, "refresh": True, "bulk": True}
        buttons.update(declared)
        buttons["add"] = bool(access["create"] and declared.get("add", True))
        buttons["bulk"] = bool(
            self.bulk_actions
            and (access["update"] or access["delete"]
                 or self.normalized_custom_bulk_actions())
            and declared.get("bulk", True)
        )
        return buttons

    def normalized_custom_bulk_actions(self):
        """normalizedCustomBulkActions(). Only entries with a usable `value`
        survive, because that value is what post_bulk_action() matches on."""
        return [
            entry for entry in (self.custom_bulk_actions or [])
            if isinstance(entry, dict) and BULK_ACTION_RE.match(str(entry.get("value", "")))
        ]

    def index_props(self, extra=None):
        """The query pipeline all three page modes share."""
        stmt = self.index_query()
        stmt = self.custom_index_query(stmt)
        stmt = self.apply_search(stmt)
        stmt = self.apply_filters(stmt)
        stmt = self.order_by(stmt)
        return self.render_index(self.paginate(stmt), extra)

    def find_row(self, record_id):
        """The single record edit mode opens with.

        Built on index_query(), so it can only ever return declared columns:
        a module that keeps a password hash out of its list cannot leak it
        through the edit form either.
        """
        if record_id is None:
            return None
        stmt = self.index_query().where(
            self.table.c[self.primary_key] == self.cast_key(record_id)
        )
        row = self.db.execute(stmt).mappings().first()
        return self.build_row(row) if row else None

    def cast_key(self, value):
        """A URL segment is always a string; the primary key usually is not."""
        try:
            if self.table.c[self.primary_key].type.python_type is int:
                return int(value)
        except (NotImplementedError, TypeError, ValueError):
            pass
        return value

    # --- Validation and payload ---------------------------------------
    def validate(self, data):
        errors = {}
        for name, config in self.form_fields.items():
            value = data.get(name)
            label = config.get("label", name)
            if config.get("required") and value in (None, ""):
                errors[name] = f"{label} is required."
                continue
            if value in (None, ""):
                continue
            maximum = config.get("max")
            if maximum and isinstance(value, str) and len(value) > maximum:
                errors[name] = f"{label} must be at most {maximum} characters."
        if errors:
            raise HTTPException(status_code=422, detail=errors)
        return data

    def payload(self, data):
        """Keep only declared form columns, drop nulls -- same as Laravel,
        including its documented caveat: because nulls are dropped you
        cannot CLEAR a nullable field through the default path. Override
        this or before_update() in a module that needs to."""
        return {k: v for k, v in data.items() if k in self.form_columns and v is not None}

    def require(self, capability):
        """CommonHelpers::isCreate()/isUpdate()/isDelete(), via
        permitted_actions() so one rule covers the route and the button.

        Still not per-role authorization: common_helpers has no privilege
        table to read, so its PRIVILEGES_DEFAULT decides the non-superadmin
        answer. That constant is where real RBAC lands.
        """
        permitted = common_helpers.permitted_actions(
            self.actions, self.user, self.module.path
        )
        if not permitted.get(capability, False):
            common_helpers.deny()

    def record_id(self):
        value = self.body.get(self.primary_key)
        if value is None:
            raise HTTPException(status_code=422, detail=f"'{self.primary_key}' is required")
        return value

    def status_columns(self):
        """statusColumns() -- the form columns a set_active/set_inactive
        bulk action is allowed to write."""
        return [
            c for c in self.form_columns
            if c in ("status", "is_active") or c.endswith("_status")
        ]

    # --- Actions (inherited by every module) --------------------------
    @action
    def get_index(self):
        return self.index_props()

    @action
    def get_add(self):
        """GET /<path>/add -- Laravel's getAdd().

        The same list, plus the mode that tells the React page to open its
        create panel on load. Reached only when a module sets use_add_route;
        otherwise "New" opens that panel without navigating anywhere.
        """
        self.require("create")
        return self.index_props({"pageMode": "create"})

    @action
    def get_edit(self, record_id=None):
        """GET /<path>/edit/<id> -- Laravel's getEdit($id).

        record_id has to keep its default: dynamic.py checks arity with
        signature().bind() before dispatching, so without it a bare
        /<path>/edit would 404 instead of opening an empty form.
        """
        self.require("edit")
        return self.index_props({
            "pageMode": "edit",
            "editRow": self.find_row(record_id),
        })

    @action
    def post_store(self):
        self.require("create")
        payload = self.payload(self.validate(self.body))
        common_helpers.stamp_created(payload, self.has_created_at)
        common_helpers.stamp_updated(payload, self.has_updated_at)
        payload = self.before_store(payload)
        # Postgres RETURNING -- no insertGetId() dance needed.
        new_id = self.db.execute(
            self.table.insert().values(**payload).returning(self.table.c[self.primary_key])
        ).scalar_one()
        self.db.commit()
        self.after_store(payload, new_id)
        return {"message": "Data saved.", "status": "success", "id": new_id}

    @action
    def post_update(self):
        self.require("edit")
        record_id = self.record_id()
        payload = self.payload(self.validate(self.body))
        common_helpers.stamp_updated(payload, self.has_updated_at)
        payload = self.before_update(payload, record_id)
        self.db.execute(
            self.table.update()
            .where(self.table.c[self.primary_key] == record_id)
            .values(**payload)
        )
        self.db.commit()
        self.after_update(payload, record_id)
        return {"message": "Data updated.", "status": "success"}

    @action
    def post_delete(self):
        self.require("delete")
        record_id = self.record_id()
        self.before_delete(record_id)
        self.db.execute(
            self.table.delete().where(self.table.c[self.primary_key] == record_id)
        )
        self.db.commit()
        self.after_delete(record_id)
        return {"message": "Data deleted.", "status": "success"}

    # --- Bulk actions --------------------------------------------------
    @action
    def post_bulk_action(self):
        """POST /<path>/bulk-action -- Laravel's postBulkAction().

        Body: {"selectedIds": [1, 2], "bulkAction": "delete"}

        Three built-ins, then the module's own list. An unrecognised name is
        422 rather than a silent no-op, so a stale button in the browser
        says so instead of appearing to work.
        """
        if not self.bulk_actions:
            raise HTTPException(
                status_code=403,
                detail="Bulk actions are disabled for this module.",
            )

        ids = self.body.get("selectedIds")
        name = str(self.body.get("bulkAction") or "")
        if not isinstance(ids, list) or not ids:
            raise HTTPException(
                status_code=422,
                detail={"selectedIds": "Select at least one record."},
            )
        if not BULK_ACTION_RE.match(name):
            raise HTTPException(
                status_code=422, detail={"bulkAction": "Unknown bulk action."}
            )

        ids = [self.cast_key(value) for value in ids]

        if name == "delete":
            return self.bulk_delete(ids)
        if name in ("set_active", "set_inactive"):
            return self.bulk_status_update(ids, name == "set_active")

        custom = next(
            (entry for entry in self.normalized_custom_bulk_actions()
             if entry.get("value") == name),
            None,
        )
        if custom is None:
            raise HTTPException(status_code=422, detail="Unknown bulk action.")
        return self.handle_custom_bulk_action(ids, name, custom)

    def bulk_delete(self, ids):
        """bulkDelete()."""
        self.require("delete")
        self.before_bulk_delete(ids)
        self.db.execute(
            self.table.delete().where(self.table.c[self.primary_key].in_(ids))
        )
        self.db.commit()
        self.after_bulk_delete(ids)
        return {"message": "Selected records deleted.", "status": "success"}

    def bulk_status_update(self, ids, is_active):
        """bulkStatusUpdate(). Prefers an is_active integer column, then the
        first status column the module declared."""
        self.require("edit")

        payload = {}
        if "is_active" in self.table.c:
            payload["is_active"] = 1 if is_active else 0
        else:
            status = next((c for c in self.status_columns() if c in self.table.c), None)
            if status is None:
                raise HTTPException(
                    status_code=422,
                    detail="This table has no status, *_status, or is_active column.",
                )
            payload[status] = "ACTIVE" if is_active else "INACTIVE"

        common_helpers.stamp_updated(payload, self.has_updated_at)
        payload = self.before_bulk_status_update(ids, payload, is_active)
        self.db.execute(
            self.table.update()
            .where(self.table.c[self.primary_key].in_(ids))
            .values(**payload)
        )
        self.db.commit()
        self.after_bulk_status_update(ids, payload, is_active)
        return {"message": "Selected records updated.", "status": "success"}

    # --- Export --------------------------------------------------------
    @action
    def post_export(self):
        """POST /<path>/export -- Laravel's postExport().

        Body: {"fileformat": "csv"|"xlsx", "filename": ..., "limit": ...,
               "columns": [...]}

        Runs the same query the list does, minus pagination, and streams the
        result back as a file. `columns` is intersected with the declared
        fields, so export can never widen what the module exposes.

        Upstream also emits PDF through DomPDF; there is no PDF library in
        this project's requirements, so that format is refused by name
        rather than silently downgraded.
        """
        self.require("view")

        fmt = str(self.body.get("fileformat") or "csv").lower()
        filename = re.sub(r"[\\/]+", "-", str(self.body.get("filename") or self.table_name))

        requested = self.body.get("columns") or []
        columns = [c for c in requested if c in self.selected and not c.startswith("__")]
        columns = columns or self.export_columns()
        headings = self.export_headings()

        stmt = self.index_query()
        stmt = self.custom_index_query(stmt)
        stmt = self.apply_search(stmt)
        stmt = self.apply_filters(stmt)
        stmt = self.order_by(stmt)

        limit = self.body.get("limit")
        try:
            if limit is not None and int(limit) > 0:
                stmt = stmt.limit(int(limit))
        except (TypeError, ValueError):
            pass

        rows = [self.build_row(row) for row in self.db.execute(stmt).mappings().all()]

        if fmt == "csv":
            return self.csv_response(rows, columns, headings, filename)
        if fmt in ("xls", "xlsx"):
            return self.xlsx_response(rows, columns, headings, filename)
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported export format '{fmt}'. Use csv or xlsx.",
        )

    def export_columns(self):
        """exportColumns() -- everything declared except the primary key."""
        return [
            alias for alias in self.selected
            if alias not in (self.primary_key, "id") and not alias.startswith("__")
        ]

    def export_headings(self):
        """exportHeadings() -- alias -> the label the list view shows."""
        return {alias: self.column_labels.get(alias, alias) for alias in self.selected}

    @staticmethod
    def export_value(row, column):
        """One cell. __rowIndex carries a display label for badge columns,
        and that is what belongs in a spreadsheet, not the raw code."""
        meta = (row.get("__rowIndex") or {}).get(column)
        if isinstance(meta, dict) and "label" in meta:
            return meta["label"]
        value = row.get(column)
        return "" if value is None else value

    def download(self, buffer, media_type, filename):
        """One place that builds the attachment response, so the header
        cannot drift between formats."""
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    def csv_response(self, rows, columns, headings, filename):
        text = io.StringIO(newline="")
        writer = csv.writer(text)
        writer.writerow([headings.get(c, c) for c in columns])
        for row in rows:
            writer.writerow([self.export_value(row, c) for c in columns])
        # utf-8-sig: the BOM is what makes Excel read accented text properly.
        buffer = io.BytesIO(text.getvalue().encode("utf-8-sig"))
        return self.download(buffer, "text/csv; charset=utf-8", f"{filename}.csv")

    def xlsx_response(self, rows, columns, headings, filename):
        try:
            from openpyxl import Workbook
        except ImportError:
            raise HTTPException(
                status_code=422,
                detail="XLSX export needs the openpyxl package. "
                       "Install it, or export as csv.",
            )
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = (self.module.name or self.table_name)[:31]
        sheet.append([headings.get(c, c) for c in columns])
        for row in rows:
            sheet.append([self.export_value(row, c) for c in columns])
        buffer = io.BytesIO()
        workbook.save(buffer)
        return self.download(
            buffer,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            f"{filename}.xlsx",
        )

    # --- Hooks: override in a module, no-ops by default ----------------
    def custom_index_query(self, stmt):
        return stmt

    def index_row(self, row):
        return row

    def row_index(self, row):
        """rowIndex() -- per-cell presentation this module wants to add:
        {"status": {"label": "Active", "className": "badge"}}."""
        return {}

    def before_store(self, payload):
        return payload

    def after_store(self, payload, record_id):
        pass

    def before_update(self, payload, record_id):
        return payload

    def after_update(self, payload, record_id):
        pass

    def before_delete(self, record_id):
        pass

    def after_delete(self, record_id):
        pass

    def before_bulk_delete(self, ids):
        pass

    def after_bulk_delete(self, ids):
        pass

    def before_bulk_status_update(self, ids, payload, is_active):
        return payload

    def after_bulk_status_update(self, ids, payload, is_active):
        pass

    def handle_custom_bulk_action(self, ids, name, config):
        """handleCustomBulkAction(). Reached only for a value the module
        declared in custom_bulk_actions, so an override can switch on `name`
        without re-checking it."""
        return {"message": "Nothing to do.", "status": "success"}

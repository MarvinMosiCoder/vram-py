"""Python equivalent of Laravel's app/Helpers/GeneratedModuleController.php.

A module declares metadata; this base class turns it into a query, a
paginated response, and validated create/update/delete. Every @action
here is inherited, so a subclass gets the whole CRUD surface for free.
"""
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import Table, asc, desc, func, or_, select

from app.core.database import Base
from app.modules.registry import action


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
        self.columns = [c for c in self.table_fields if c in self.table.c]
        self.column_labels = {k: v.get("label", k) for k, v in self.table_fields.items()}
        self.form_columns = [c for c in self.form_fields if c in self.table.c]

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
        wanted = {self.primary_key, *self.columns, *self.form_columns}
        return select(*[self.table.c[c] for c in wanted if c in self.table.c])

    def apply_search(self, stmt):
        term = self.param("search")
        if not term or not self.search_columns:
            return stmt
        clauses = [
            self.table.c[c].ilike(f"%{term}%")
            for c in self.search_columns
            if c in self.table.c
        ]
        return stmt.where(or_(*clauses)) if clauses else stmt

    def apply_filters(self, stmt):
        """Any query param named after a declared column filters on it:
        /roles?name=Super

        The `not in self.columns` skip IS the allowlist -- without it a
        caller could filter on columns the module deliberately hides."""
        for key, value in self.request.query_params.items():
            if key not in self.columns or value == "":
                continue
            column = self.table.c[key]
            try:
                is_text = column.type.python_type is str
            except NotImplementedError:
                is_text = False
            if is_text:
                stmt = stmt.where(column.ilike(f"%{value}%"))
            elif value.lstrip("-").isdigit():
                stmt = stmt.where(column == int(value))
        return stmt

    def order_by(self, stmt):
        requested = self.param("sort_by")
        allowed = {*self.columns, *self.form_columns, self.primary_key}
        if requested not in allowed:                    # sortColumn()'s allowlist
            requested = self.default_sort or self.primary_key
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
            "rows": [self.index_row(dict(row)) for row in rows],
            "total": total,
            "page": page,
            "per_page": per_page,
            "last_page": max(1, -(-total // per_page)),
        }

    def render_index(self, paginated):
        """Laravel's renderIndex() -- the props the React page renders from."""
        rows = paginated.pop("rows")
        return {
            "module": {
                "name": self.module.name,
                "path": self.module.path,
                "icon": self.module.icon,
            },
            "primaryKey": self.primary_key,
            "columns": [
                {"key": key, "label": config.get("label", key)}
                for key, config in self.table_fields.items()
            ],
            "formFields": self.form_fields,
            "actions": self.actions,
            "rows": rows,
            "pagination": paginated,
        }

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
        """Stands in for CommonHelpers::isCreate()/isUpdate()/isDelete().
        Enforces only the module's own action flags -- this is NOT
        per-role authorization yet."""
        if not self.actions.get(capability, False):
            raise HTTPException(status_code=403, detail="Denied access.")

    def record_id(self):
        value = self.body.get(self.primary_key)
        if value is None:
            raise HTTPException(status_code=422, detail=f"'{self.primary_key}' is required")
        return value

    # --- Actions (inherited by every module) --------------------------
    @action
    def get_index(self):
        stmt = self.index_query()
        stmt = self.custom_index_query(stmt)
        stmt = self.apply_search(stmt)
        stmt = self.apply_filters(stmt)
        stmt = self.order_by(stmt)
        return self.render_index(self.paginate(stmt))

    @action
    def post_store(self):
        self.require("create")
        payload = self.payload(self.validate(self.body))
        if self.has_created_at:
            payload["created_at"] = datetime.utcnow()
        if self.has_updated_at:
            payload["updated_at"] = datetime.utcnow()
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
        if self.has_updated_at:
            payload["updated_at"] = datetime.utcnow()
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

    # --- Hooks: override in a module, no-ops by default ----------------
    def custom_index_query(self, stmt):
        return stmt

    def index_row(self, row):
        return row

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

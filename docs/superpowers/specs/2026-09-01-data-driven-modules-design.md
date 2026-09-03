# Data-driven modules — design

> **SUPERSEDED, 2026-09-01.** This spec proposed moving module field config
> into JSONB columns on `adm_modules`. It was built, then reverted the same
> day in favour of aligning with the Laravel original, which **generates a
> controller file** instead — `adm_modules` keeps its original seven columns.
>
> What survived: `registry.discover()` (the filesystem as registry), the
> circular-import fix, `helpers/`, and the `admin/` package restructure.
> What was reverted: the nine columns and their migration,
> `DataDrivenModuleController`, and the `NEVER_EXPOSE` runtime denylist —
> which became a generation-time skip list in
> `helpers/module_generator.py` instead.
>
> Kept for the reasoning, especially the rejected alternatives and the
> trust-boundary analysis. See `docs/MODULES.md` for what actually shipped.


**Date:** 2026-09-01
**Status:** approved, not yet implemented
**Scope:** the module engine only. The Modules admin screen that will create
module rows through the UI is a separate spec — see [Deferred](#deferred).

## Problem

The dynamic module system promises "a row in `adm_modules` plus a class equals
a working CRUD API". In practice adding a module takes four steps, and two of
them are bookkeeping:

1. `INSERT INTO adm_modules (...)` — data
2. write `app/modules/admin/<name>_module.py` declaring the field metadata — code
3. decorate the class `@controller("XController")` — code
4. add `from app.modules.admin import <name>_module` to
   `app/modules/admin/__init__.py` — **pure bookkeeping**

Step 4 carries no information. It exists only because importing a Python module
is what executes its decorator, and Python has no autoloader. Miss the line and
the route returns `500 unregistered controller` even though the class is sitting
right there.

Step 2 is the larger problem: for a module that needs no custom behaviour, the
class is a bag of literals that could equally be rows.

### How the Laravel original avoids this

There is no registration step upstream. `routes/web.php:212` reads:

```php
$modules = DB::table('adm_modules')
    ->whereIn('controller', CommonHelpers::getMainControllerFiles())
    ->get();
foreach ($modules as $v) {
    CommonHelpers::routeController($v->path, $v->controller, 'app\Http\Controllers\Admin');
}
```

`getMainControllerFiles()` is `glob('app/Http/Controllers/Admin/*.php')`, and
`routeController()` resolves the class by name through PSR-4 autoloading and
`ReflectionClass`. **The filesystem is the registry, and the glob is the
allowlist.** Python can have both properties with `pkgutil.iter_modules()` and
`importlib.import_module()`.

Upstream solves step 2 differently again: `ModulsController.php` is a *code
generator* that writes a controller file and a matching JSX file from a template.
This design does not port that. It makes the metadata data instead, which suits
a stack where the React runtime already renders any module from its response.

## Goals

- Adding a module requires **one `INSERT`** and no Python file.
- A controller class remains available for modules that need real behaviour, and
  when present it wins.
- Removing the hand-maintained import list, for class-based modules too.
- No loss of the existing guards. Specifically: a module must never be able to
  select, sort, filter or search a sensitive column.
- A misconfigured module stays a loud `500`, never a silent `404`.

## Non-goals

- Generating Python files. Metadata becomes data; it is not code-generated.
- Changing the response shape `render_index()` sends. The React runtime is
  untouched by this work.
- Per-role module authorization. That still waits on the privilege tables and
  `common_helpers.PRIVILEGES_DEFAULT`.

## Decisions

| Decision | Chosen | Why |
|---|---|---|
| How far "no code" goes | Rows only; a `.py` is optional and only for custom behaviour | The common case is a bag of literals |
| Where field config lives | JSONB columns on `adm_modules` | `dynamic.py` already loads that row, so zero extra queries; shape is identical to what a class declares today |
| Sensitive-column guard | A code-side denylist the JSON cannot override | Field config becomes admin-editable data; the column allowlist must not |
| Controller discovery | Eager scan-and-import at startup | Direct translation of `glob()` + PSR-4; keeps `@controller` so the DB string stays authoritative rather than implied by a filename |

### Rejected alternatives

**Lazy import by naming convention** (`RolesController` → `app.modules.admin.roles_module`,
imported on first request). Drops the decorator entirely, but welds the database
string to the filename, worsens the error message when resolution fails, and
removes the ability to name a class differently from its file. The saving —
not importing unused modules — is worth nothing at this size.

**Glob for the allowlist, import on demand** (Laravel's exact shape). Faithful,
but it adds a second code path to buy lazy loading that is not needed.

**Introspecting the table for its columns.** One row and nothing else, but it
needs a denylist to be safe *and* gives no control over column order or which
fields are form-only. A denylist protecting a derived list is strictly weaker
than a denylist protecting an explicit one.

## Schema

One Alembic revision on top of `4a53b9d60757`. All plain adds, so
`--autogenerate` produces it correctly, but the file is read before it is
applied.

```sql
ALTER TABLE adm_modules
  ADD COLUMN primary_key    varchar(255) DEFAULT 'id',
  ADD COLUMN default_sort   varchar(255),
  ADD COLUMN per_page       integer      DEFAULT 15,
  ADD COLUMN has_created_at smallint     DEFAULT 0,
  ADD COLUMN has_updated_at smallint     DEFAULT 0,
  ADD COLUMN table_fields   jsonb,
  ADD COLUMN form_fields    jsonb,
  ADD COLUMN search_columns jsonb,
  ADD COLUMN actions        jsonb;
```

That is every knob `ModuleController` exposes. `table_name` and `controller`
already exist, and `controller` is already nullable — so "NULL means generic"
needs no schema change.

`app/models/admin/module.py` gains the nine columns, using
`sqlalchemy.dialects.postgresql.JSONB` for the four JSON ones.
`app/schemas/admin/module.py` gains them too; `ModuleOut` is currently served by
no route, so this is for completeness rather than a contract change.

## Components

### `DataDrivenModuleController` — `app/helpers/generated_module.py`

Sits beside its parent in the same file. It sets instance attributes from the
row *before* calling `super().__init__()`; the base class derives `columns` and
`form_columns` from `self.table_fields`, and instance attributes shadow class
ones, so nothing in the base needs to change to accommodate it.

```python
class DataDrivenModuleController(ModuleController):
    """A module with no class of its own. Every attribute a subclass would
    declare is read off the adm_modules row instead."""

    def __init__(self, module, db, user, request, body=None):
        self.primary_key    = module.primary_key or "id"
        self.table_fields   = _as_dict(module.table_fields)
        self.form_fields    = _as_dict(module.form_fields)
        self.search_columns = _as_list(module.search_columns)
        self.default_sort   = module.default_sort
        self.per_page       = module.per_page or 15
        self.has_created_at = bool(module.has_created_at)
        self.has_updated_at = bool(module.has_updated_at)
        self.actions        = _as_dict(module.actions) or ModuleController.actions
        super().__init__(module, db, user, request, body)
```

It inherits all four `@action` methods and all eight hooks unchanged, so a JSONB
module gets exactly the surface a class-based one gets.

`_as_dict` / `_as_list` are the malformed-JSONB guard. Postgres validates that a
value is JSON, not that it has the right *shape* — a row with
`table_fields: ["name"]` would raise `AttributeError` on `.items()`. Anything of
the wrong type coerces to `{}` / `[]`.

### Discovery — `app/modules/admin/__init__.py`

The import list is replaced by a scan:

```python
import importlib
import pkgutil

# The filesystem is the registry, exactly as the Laravel original's
# glob('Controllers/Admin/*.php') is. Dropping a *_module.py in this folder
# registers it; there is no list to keep in sync.
for info in pkgutil.iter_modules(__path__):
    importlib.import_module(f"{__name__}.{info.name}")
```

`@controller` still fires and `CONTROLLERS` still ends up the allowlist — it is
now derived rather than maintained. `uvicorn --reload` restarts when a file is
added to the folder, so the rescan is automatic in development.

### Denylist — `app/helpers/common_helpers.py`

```python
NEVER_EXPOSE = {
    "*":         {"password", "remember_token"},
    "adm_users": {"token_version", "last_password_updated"},
}

def denied_columns(table_name) -> set:
    return NEVER_EXPOSE.get("*", set()) | NEVER_EXPOSE.get(table_name, set())
```

Applied in **`ModuleController.__init__`**, not in the data-driven subclass, so
it guards class-based controllers too. One chokepoint covers everything:
`index_query()` selects from `self.columns` / `self.form_columns` /
`primary_key`; `order_by()` and `apply_filters()` allowlist against
`self.columns`; `apply_search()` reads `self.search_columns`. Filtering those
four at construction time closes every path at once.

`render_index()` also builds its `columns` list straight from
`self.table_fields.items()`, so denied keys are filtered there as well —
otherwise a denied column would render as a header over empty cells. The
existing behaviour where a `table_fields` key naming a *nonexistent* column
still produces a header is deliberate and is preserved; only denied columns are
removed.

### Resolution — `app/api/dynamic.py`

```python
name = (module.controller or "").strip()
if not name:
    controller_cls = DataDrivenModuleController
else:
    controller_cls = CONTROLLERS.get(name)
    if controller_cls is None:
        raise HTTPException(
            status_code=500,
            detail=f"Module '{module.path}' names unregistered controller '{name}'",
        )
```

## Data flow

Unchanged from `MODULES.md`'s "One request, end to end" except at the class
lookup:

```
GET /menus
  RequireAuthMiddleware            bearer token or 401
  dynamic.py  MODULE_PATH_RE       ^[a-z0-9_-]+$ or 404
              adm_modules row      path = :p AND is_active = 1, or 404
              controller empty?    -> DataDrivenModuleController   [NEW]
              named + found        -> that class
              named + missing      -> 500
  __init__    table_name           resolved via Base.metadata.tables, or 500
              denied columns       subtracted from columns/form/search  [NEW]
  get_index   index_query -> apply_search -> apply_filters -> order_by -> paginate
  render_index                     the same JSON as today
```

## Error handling

| Condition | Result | Changed? |
|---|---|---|
| `module_path` fails the regex | `404` | no |
| No active row for that path | `404` | no |
| `controller` empty / NULL | generic controller | **new** — was a `500` |
| `controller` names no class | `500 names unregistered controller 'X'` | no |
| `table_name` not on `Base.metadata` | `500 names unknown table 'y'` | no |
| Method missing or not `@action` | `404` | no |
| `table_fields` is valid JSON of the wrong shape | coerced to `{}`; module serves an empty column set | **new** |
| A field names a denied column | silently dropped from columns/form/search | **new** |
| Capability not permitted | `403 Denied access.` | no |
| Validation failure | `422`, field-keyed | no |

The one behaviour change is row three: an empty `controller` used to be a
configuration error and is now a legitimate module. A *wrong* controller name is
still a `500`, which is the property worth keeping — it distinguishes "this
module is broken" from "no such page".

## Security

The trust boundary moves, and this is the part to review carefully.

**Before:** `adm_modules` decided *which code runs*. Field metadata lived in
Python, so database write access could enable, disable, rename or re-icon a
module but could not change which columns it exposed.

**After:** `adm_modules` also decides *which columns are exposed*. A row could
otherwise say `{"password": {"label": "Password"}}` against `adm_users` and
render bcrypt hashes into a browser table.

`NEVER_EXPOSE` is the mitigation. It is a denylist, with the honest weakness
denylists have: a *newly added* sensitive column is exposed until someone adds
it to the dict. It was chosen over a per-table allowlist because an allowlist
would put a code edit back into the module-creation path — the exact thing this
design removes.

The other six guards from `MODULES.md`'s trust-boundary table are untouched:
the path regex, the `is_active` filter, the `CONTROLLERS` dict (now
filesystem-derived, same property), the `@action` marker, the
`Base.metadata.tables` lookup, and the `inspect.signature().bind()` arity check.

## Docs

- `docs/MODULES.md` — "Adding a module" drops from six steps to two. The
  trust-boundary table gains a denylist row, and its `CONTROLLERS` row is
  reworded as filesystem-derived. "Known gaps" loses the registration footgun.
- `docs/ARCHITECTURE.md` — the "Dynamic modules" section's description of the
  code/data split changes: an admin can now introduce a *module* without code,
  though still not new *behaviour* or access to an undeclared table.
- `docs/api/modules.md` — the error table gains the empty-controller row.
- `STUDY_GUIDE.md` §8 — "Registration happens at import time" is no longer true
  as written.

## Deferred

Not in this spec, in rough dependency order:

1. **A `json` field type** in `GeneratedModulePage.jsx` — a `<textarea>` that
   parses on submit and reports syntax errors through the existing `InputError`
   slot. Required before JSONB config can be edited in a browser; the renderer
   currently supports only `checkbox`, `select`, `number` and `text`.
2. **An `is_protected` guard.** The column is declared on the model and the
   schema and read by nothing. Once modules are editable through the UI, deleting
   or deactivating the Modules row locks you out of the Modules screen. A
   `before_delete()` refusing protected rows, plus the same check on an update
   that clears `is_active`, closes it.
3. **Clearing a nullable field.** `payload()` drops `None`, so a set
   `default_sort` can never be unset. This needs a decision about how a request
   body distinguishes "omitted" from "explicitly emptied", and it changes
   `payload()` for every module — not only this one.
4. **The Modules CRUD screen**, which depends on 1–3.

## Known interaction

`app/modules/admin/users_module.py` is a reachability demo, not a real module —
its `get_index` returns stub data. There is no `users` row in `adm_modules`
today, so it is inert. Under this design, adding one would resolve to the demo
class rather than to a generic data-driven module, because a class always wins
over a row. Deleting the file is a reasonable follow-up but is not part of this
spec.

> **Update, 2026-09-03.** This paragraph is now historical along with the
> rest of the superseded design above: `users_module.py` stopped being a
> demo and became a real module (table, joined `role_name` display,
> `id_adm_role` FK-select, bulk actions), and `adm_modules` has had a
> `users` row this whole time — the class-always-wins-over-a-row
> observation above was never actually exercised for it. See
> [`../../MODULES.md`](../../MODULES.md#known-gaps) for where the module
> currently stands.

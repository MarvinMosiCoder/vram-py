# Module routes

*(`backend/app/api/dynamic.py`)*

See [../API.md](../API.md) for the shared authentication header/error
format that applies to every route in this project, and
[../MODULES.md](../MODULES.md) for how a module is declared, what the
guards do, and how to add one.

**These paths are data-driven.** There is no fixed list of them: three
catch-all routes serve whatever rows are in `adm_modules`, so the routes
that exist on a given database are `SELECT path FROM adm_modules WHERE
is_active = 1`. On a seeded database that is two modules, `roles` and
`menus`.

Those rows come from `ModulesSeeder` (`python seed.py`). Nothing seeded
`adm_modules` before, so a fresh database had no modules at all until one
was inserted by hand. See
[../MODULES.md](../MODULES.md#adding-a-module).

---

## The three routes

Each is registered for both `GET` and `POST`, and each resolves to a
method on the module's controller by name:

| Route | Method resolved | Example |
|---|---|---|
| `/{module_path}` | `<verb>_index` | `GET /roles` → `get_index()` |
| `/{module_path}/{action}` | `<verb>_<action>` | `POST /roles/store` → `post_store()` |
| `/{module_path}/{action}/{rest:path}` | the same, remaining segments as positional args | `GET /roles/edit/7` → `get_edit("7")` |

Hyphens in the action become underscores: `POST /roles/bulk-action` →
`post_bulk_action()`. Positional arguments are always **strings**, which
is why `get_edit()` casts through `cast_key()` before querying.

Eight actions ship on the base class, so every metadata-driven module has
all of them without writing a line:

| Path | Action | Purpose |
|---|---|---|
| `GET /<path>` | `get_index` | the list |
| `GET /<path>/add` | `get_add` | the list, opened on the create form |
| `GET /<path>/edit/<id>` | `get_edit` | the list, opened on that record |
| `POST /<path>/store` | `post_store` | create |
| `POST /<path>/update` | `post_update` | update |
| `POST /<path>/delete` | `post_delete` | delete one |
| `POST /<path>/bulk-action` | `post_bulk_action` | delete or set status on many |
| `POST /<path>/export` | `post_export` | download the current query as a file |

A method is only reachable if it carries the `@action` decorator. One
that exists without it returns `404`, not `403` — the dispatcher treats
undecorated methods as if they were not there.

**Auth:** any authenticated user, for every route above. There is
currently **no per-role check** on module routes; a module's `actions`
flags gate *capability* (create/edit/delete), not *who*. See
[../MODULES.md](../MODULES.md#known-gaps).

---

## `GET /{module_path}`

The index. The only route the React UI calls today, and the one every
metadata-driven module gets for free.

**Query parameters**

| Name | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | matched with `ILIKE %term%` across the module's `search_columns`. Ignored if the module declares none |
| `page` | int | `1` | clamped to a minimum of `1`; `0` or a negative value becomes `1` |
| `per_page` | int | the module's `per_page` (15) | clamped to `1`–`100` |
| `sort_by` | string | `default_sort`, else the primary key | must name a declared column; **an unknown column is silently ignored**, not rejected |
| `sort_dir` | `asc` \| `desc` | `asc` | anything other than `desc` is treated as `asc` |
| any declared column | string | — | filters on that column: `ILIKE %value%` for text, exact match for an integer. An empty value is skipped |

Two consequences of that last row worth knowing. `GET /roles?name=super`
is a filter, and `GET /roles?password=x` is not — a column the module did
not declare in `table_fields` is not filterable, which is what keeps the
open-ended filtering safe. A malformed `page` or `per_page` falls back to
the default rather than erroring.

**Response** `200 OK` — for `GET /roles`, with a `roles` module row in
place and only the Super Administrator role in `adm_roles`:

```json
{
  "module": { "name": "Roles", "path": "roles", "icon": "fa fa-key" },
  "primaryKey": "id",
  "columns": [
    { "key": "id", "label": "ID" },
    { "key": "name", "label": "Role" },
    { "key": "is_superadmin", "label": "Superadmin" },
    { "key": "theme_color", "label": "Theme" }
  ],
  "formFields": {
    "name": { "label": "Role", "type": "text", "required": true, "max": 255 },
    "is_superadmin": { "label": "Superadmin", "type": "checkbox" },
    "theme_color": { "label": "Theme", "type": "text", "max": 255 }
  },
  "actions": { "view": true, "create": true, "edit": true, "delete": true },
  "moduleAccess": { "view": true, "create": true, "update": true, "delete": true },
  "tableName": "adm_roles",
  "customRowActions": [],
  "customIndexButtons": [],
  "customBulkActions": [],
  "bulkActions": true,
  "indexButtons": { "add": true, "export": true, "refresh": true, "bulk": true },
  "useAddRoute": false,
  "useEditRoute": false,
  "pageMode": null,
  "editRow": null,
  "rows": [
    { "id": 1, "name": "Super Administrator", "is_superadmin": 1, "theme_color": null }
  ],
  "pagination": { "total": 1, "page": 1, "per_page": 15, "last_page": 1 }
}
```

| Field | Meaning |
|---|---|
| `module` | `name`, `path`, `icon` straight off the `adm_modules` row |
| `primaryKey` | the column the React table keys rows by, and the field a write action expects |
| `columns` | one entry per `table_fields` key, **in declaration order** — this is the column order in the UI |
| `formFields` | the raw `form_fields` dict, sent for a create/edit form that does not exist yet |
| `actions` | the module's capability flags ANDed with the caller's privileges, so the UI can hide buttons |
| `moduleAccess` | the privileges alone, with no reference to the module's config. Note the key is `update`, not `edit` — matching the original |
| `tableName` | the resolved table, used as the default export filename |
| `customRowActions` / `customIndexButtons` / `customBulkActions` | the module's declared extras, always arrays |
| `bulkActions` / `indexButtons` | whether the bulk toolbar is on, and which toolbar buttons to draw |
| `useAddRoute` / `useEditRoute` | whether create/edit navigate to a URL instead of opening the panel in place |
| `pageMode` / `editRow` | `null` on the index; filled by `/add` and `/edit/<id>`. Always present so the shape never changes |
| `rows` | only columns that exist on the table or resolve through a `select`; `total` is a separate `COUNT` over the unpaginated query. A row may also carry `__rowIndex`, which is per-cell presentation rather than data |
| `pagination` | `last_page` is `ceil(total / per_page)`, never below `1` |

`rows` may carry columns that are not in `columns` — the query selects
the primary key and every declared form column too, so a field used only
by the form is available to a custom `renderCell`.

---

## `POST /{module_path}/store`

Create a row. `require("create")` first, then validation, then an insert
using Postgres `RETURNING` so the new id comes back in one statement.

**Request body** — `application/json` or form-encoded. Keys are
`form_fields` names; anything else is dropped.

```json
{ "name": "Editor", "theme_color": "#93701A" }
```

**Response** `200 OK`

```json
{ "message": "Data saved.", "status": "success", "id": 2 }
```

## `POST /{module_path}/update`

Update one row. The body must include the primary key.

```json
{ "id": 2, "name": "Content Editor" }
```

**Response** `200 OK` — `{ "message": "Data updated.", "status": "success" }`

Keys with a `null` value are dropped before the update, so **a nullable
column cannot be cleared through this route**. That caveat is inherited
from the Laravel original; see
[../MODULES.md](../MODULES.md#where-this-deliberately-diverges).

## `POST /{module_path}/delete`

Delete one row. Body is just the primary key.

```json
{ "id": 2 }
```

**Response** `200 OK` — `{ "message": "Data deleted.", "status": "success" }`

These three were broken until 2026-08-31 — the request body reached the
controller as an un-awaited coroutine, so every `POST` raised
`AttributeError: 'coroutine' object has no attribute 'get'`. Fixed by
awaiting it in each of the three handlers; the shapes above are verified
against the running API.

Note that `store` returns `403 Denied access.` when the module's `actions`
does not declare `create` — that is `require()` working, not a bug. See
[../MODULES.md](../MODULES.md#the-modulecontroller-contract).

**`/users/store` and `/users/update` do not match the shapes above.**
`UsersController` overrides both with its own `_save_users()` instead of
inheriting the base implementation documented here — see
[../MODULES.md](../MODULES.md#adding-a-module)'s note on
`users_module.py`. Two concrete differences, verified against the running
API:

| | Documented above | `/users/store` and `/users/update` |
|---|---|---|
| Success body | `{"message", "status", "id"}` / `{"message", "status"}` | `{}` — `_save_users()` returns the raw SQLAlchemy row, which serializes to nothing once the session's post-commit expiry clears it |
| Validation failure | `422`, field-keyed dict | `400`, a single string in `detail` (`"name is required."` / `"Email must be unique."`) |

Every other module still gets the documented shapes; this is a
per-module deviation, not a change to the base `ModuleController`.

---

## `GET /{module_path}/add` and `GET /{module_path}/edit/{id}`

The same body as the index, plus the mode the React page opens in.
Laravel's `getAdd()` / `getEdit($id)`.

| | `/add` | `/edit/{id}` |
|---|---|---|
| Guard | `require("create")` | `require("edit")` |
| `pageMode` | `"create"` | `"edit"` |
| `editRow` | `null` | the record, or `null` if no row has that id |

`editRow` is fetched through `index_query()`, so it can only ever contain
declared columns — a module that keeps a password hash out of its list
cannot leak it through the edit form either.

`GET /<path>/edit` with **no** id is a valid request, not a `404`: it
answers `pageMode: "edit"` with `editRow: null`. The id argument keeps a
default for exactly that reason, since `dynamic.py` checks arity before
dispatching.

These two are only reachable in the UI when the module sets
`use_add_route` / `use_edit_route`; otherwise the buttons open the panel
without navigating. The endpoints answer either way.

---

## `POST /{module_path}/bulk-action`

Apply one action to many rows.

```json
{ "selectedIds": [2, 3], "bulkAction": "delete" }
```

| `bulkAction` | Effect | Guard |
|---|---|---|
| `delete` | one `DELETE ... WHERE id IN (...)` | `require("delete")` |
| `set_active` / `set_inactive` | `is_active` = `1`/`0` if the table has that column, else `"ACTIVE"`/`"INACTIVE"` into the first declared status column | `require("edit")` |
| any other value | matched against the module's `custom_bulk_actions` by `value`, then handed to `handle_custom_bulk_action()` | the module's own code |

**Response** `200 OK` — `{ "message": "Selected records deleted.", "status": "success" }`

| Status | Body | Cause |
|---|---|---|
| `403` | `{"detail": "Bulk actions are disabled for this module."}` | the module sets `bulk_actions = False` |
| `422` | `{"detail": {"selectedIds": "Select at least one record."}}` | missing, empty, or not a list |
| `422` | `{"detail": {"bulkAction": "Unknown bulk action."}}` | the name fails `^[A-Za-z0-9_-]+$` |
| `422` | `{"detail": "Unknown bulk action."}` | well-formed, but neither a built-in nor a declared custom action |
| `422` | `{"detail": "This table has no status, *_status, or is_active column."}` | `set_active` on a table with nothing to write |

Note the last one: a status bulk action on an unsuitable table refuses
rather than writing somewhere unexpected. `adm_roles` is such a table.

---

## `POST /{module_path}/export`

Download the current query as a file. Runs `custom_index_query`, the
search, the filters and the sort — everything the list does except
pagination.

```json
{ "fileformat": "csv", "filename": "roles", "limit": 500, "columns": ["name", "theme_color"] }
```

| Field | Default | Notes |
|---|---|---|
| `fileformat` | `"csv"` | `csv`, or `xlsx`/`xls` |
| `filename` | the table name | `/` and `\\` are replaced with `-`; the extension is added for you |
| `limit` | none | a positive integer caps the row count; anything else is ignored |
| `columns` | every declared field except the primary key | **intersected with the declared fields** — an undeclared name is dropped, not honoured |

**Response** `200 OK` — a streamed attachment with a `Content-Disposition`
header. `text/csv; charset=utf-8` (written with a BOM so Excel reads
accented text) or the xlsx media type.

A cell with `__rowIndex` metadata exports its `label` rather than the raw
value, so a spreadsheet says `Active` and not `1`.

| Status | Body | Cause |
|---|---|---|
| `403` | `{"detail": "Denied access."}` | the module's `actions` does not declare `view` |
| `422` | `{"detail": "XLSX export needs the openpyxl package. Install it, or export as csv."}` | `openpyxl` is not installed |
| `422` | `{"detail": "Unsupported export format 'pdf'. Use csv or xlsx."}` | any other format |

PDF is **not ported**. The Laravel original renders it through DomPDF;
there is no PDF library in `requirements.txt`, so the format is refused
by name rather than silently downgraded to a spreadsheet.

Because the success response is a binary stream, an error body arrives as
a blob too when the client asked for one — `GeneratedModulePage` reads the
blob back as text before showing the message.

---

## Errors

| Status | Body | Cause |
|---|---|---|
| `401` | `{"detail": "Not authenticated"}` | no `Authorization: Bearer` header — from `RequireAuthMiddleware`, before routing |
| `401` | `{"detail": "Could not validate credentials"}` | token malformed, expired, or revoked by a later `POST /logout` |
| `404` | `{"detail": "Not Found"}` | `module_path` fails `^[a-z0-9_-]+$` |
| `404` | `{"detail": "Not Found"}` | no `adm_modules` row with that `path`, or the row has `is_active != 1` |
| `404` | `{"detail": "Not Found"}` | the resolved method does not exist, or exists without `@action` |
| `404` | `{"detail": "Not Found"}` | wrong number of positional segments for the action's signature |
| `403` | `{"detail": "Denied access."}` | the module's `actions` flag for that capability is `False` |
| `422` | `{"detail": {"name": "Role is required."}}` | validation — a field-keyed dict, one message per failing field |
| `422` | `{"detail": "'id' is required"}` | an update or delete with no primary key in the body |
| `500` | `{"detail": "Module 'x' names unregistered controller 'YController'"}` | the row's `controller` string is not in `CONTROLLERS` — a missing import in `modules/__init__.py` |
| `500` | `{"detail": "Module 'x' names unknown table 'y'"}` | the row's `table_name` is not a table registered on `Base.metadata` |
| `500` | `{"detail": "Module 'x' joins unknown table 'y'"}` | a `table_fields` entry declares a `join` on a table not in `Base.metadata` |
| `500` | `{"detail": "Module 'x' references unknown column 'y.z'"}` | a `select`, `first` or `second` names a column that does not exist |

The two `500`s are deliberate: a row pointing at code or a table that
does not exist is a configuration error, and reporting it as `404` would
hide a broken module behind a plausible-looking "no such page".

An unhandled exception is *not* a clean `500` in the browser. It
propagates past `CORSMiddleware` before any response starts, so no
`Access-Control-Allow-Origin` header is attached and the console reports
a CORS failure instead. A CORS error with a working CORS config means the
backend crashed — check the uvicorn terminal. Same failure mode as the
one written up in [sidebar.md](sidebar.md).

---

## Laravel comparison

In the Laravel template a single catch-all route fronts
`GeneratedModuleController`, which looks the module up by path and calls
the method named by the URL segment. That is the same shape as these
three routes, with three differences worth checking during review:

| | Laravel | Here |
|---|---|---|
| Which methods are callable | reflection over **public** methods | opt-in via the `@action` decorator, because Python has no `public` |
| Wrong argument count | typically a `TypeError`/`BadMethodCall` from the call itself | checked with `inspect.signature().bind()` *before* the call, so a real `TypeError` inside a controller is not mistaken for a routing miss |
| Route ordering | Laravel matches the most specific route regardless of file order | Starlette is first-match-wins, so `dynamic.router` **must** be included last in `routers.py` |

The response body is the same set of props the Laravel `renderIndex()`
hands to Inertia — the difference is only in how it travels: Inertia
delivers page name plus props in one response, while here the browser
already has the React app and fetches these props as JSON.

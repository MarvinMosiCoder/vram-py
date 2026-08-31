# Module routes

*(`backend/app/api/dynamic.py`)*

See [../API.md](../API.md) for the shared authentication header/error
format that applies to every route in this project, and
[../MODULES.md](../MODULES.md) for how a module is declared, what the
guards do, and how to add one.

**These paths are data-driven.** There is no fixed list of them: three
catch-all routes serve whatever rows are in `adm_modules`, so the routes
that exist on a given database are `SELECT path FROM adm_modules WHERE
is_active = 1`. Today that is one module, `roles`.

Note that **nothing seeds `adm_modules`** — neither `seed.py` nor any
migration inserts a row, so the `roles` row was added by hand and a fresh
database has no modules at all until you insert one. See
[../MODULES.md](../MODULES.md#adding-a-module).

---

## The three routes

Each is registered for both `GET` and `POST`, and each resolves to a
method on the module's controller by name:

| Route | Method resolved | Example |
|---|---|---|
| `/{module_path}` | `<verb>_index` | `GET /roles` → `get_index()` |
| `/{module_path}/{action}` | `<verb>_<action>` | `POST /roles/store` → `post_store()` |
| `/{module_path}/{action}/{rest:path}` | the same, remaining segments as positional args | `GET /users/edit/7` → `get_edit("7")` |

Hyphens in the action become underscores: `POST /users/bulk-action` →
`post_bulk_action()`. Positional arguments are always **strings**.

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
| `actions` | the module's capability flags, so the UI can hide buttons |
| `rows` | only columns that exist on the table; `total` is a separate `COUNT` over the unpaginated query |
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

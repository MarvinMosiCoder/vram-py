# Sidebar routes

*(`backend/app/api/sidebar.py`)*

See [../API.md](../API.md) for the shared authentication header/error
format that applies to every route in this project, not just this one,
and [../ARCHITECTURE.md](../ARCHITECTURE.md)'s "Sidebar and menus"
section for how the menu tables fit together.

---

## `GET /admin_sidebar`

Returns the admin sidebar entries, for building the sidebar dynamically.
Reads `adm_admin_menuses` — a flat list, no nested module object.

**Auth:** any authenticated user — but note *how*. The route signature is
`sidebar(db: Session = Depends(get_db))` with **no auth dependency at
all**, so `RequireAuthMiddleware` is the only thing checking the token
here. That is the fail-closed backstop working as designed, and it also
means the route body has no `User` object to read: adding per-user or
per-role behaviour means adding `Depends(auth.get_current_user)` first.

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "name": "Roles",
    "path": "roles",
    "slug": "roles",
    "icon": "fa fa-key",
    "color": null,
    "sorting": 1,
    "parent_id": null
  }
]
```

Only rows with `is_active = 1` are returned, ordered by `sorting`.
`parent_id` is `null` for a top-level entry, or the `id` of another row
in the same table for a child of an accordion group — the frontend does
not nest them yet, it renders the flat list.

Shape is `schemas.AdminMenu` (`backend/app/schemas/admin_menus.py`);
every field except `id` is nullable.

---

## Changed on 2026-08-30

This route was `GET /sidebar` earlier the same day. What moved:

| | Before | After |
|---|---|---|
| Path | `/sidebar` | `/admin_sidebar` |
| Table | `adm_menuses` joined to `adm_modules` | `adm_admin_menuses` |
| Response schema | `MenuOut`, which then nested a `module` object | `AdminMenu` (flat, adds `parent_id`) |
| Role scoping | non-superadmins saw only their own `id_adm_role` | none — every authenticated caller gets the same list |

**Role scoping is currently gone**, and that is a behaviour change rather
than a refactor: `adm_admin_menuses` has no `id_adm_role` column, so
there is nothing to filter on. Every logged-in user sees the full admin
menu. Two ways to close that back up when it matters — gate the whole
route with `Depends(auth.require_role(1))`, or add an `id_adm_role`
column to the table and restore the per-role filter.

`MenuOut` and `adm_menuses` are both still in the codebase, and both
changed shape the same day — `MenuOut` dropped its nested `module` field
for a flat `parent_id`, matching `adm_menuses.patent_id` becoming a
self-referencing `parent_id` (migration `253f97ec1dfd`, see
[../MIGRATIONS.md](../MIGRATIONS.md#this-projects-migration-history)).
No route serves either of them right now.

### Two bugs fixed while making the switch

The first cut of the rewritten route queried `models.Modules` and ordered
by `models.Modules.sorting`. `adm_modules` has no `sorting` column, so
every request raised:

```
AttributeError: type object 'Modules' has no attribute 'sorting'
```

Worth knowing what that looks like from the browser: **not** a 500. An
unhandled exception propagates past `CORSMiddleware` before any response
starts, so no `Access-Control-Allow-Origin` header is ever attached and
the console reports

```
Access to XMLHttpRequest at 'http://localhost:8000/admin_sidebar' from origin
'http://localhost:5173' has been blocked by CORS policy: No
'Access-Control-Allow-Origin' header is present on the requested resource.
```

CORS is configured correctly in `main.py` — a CORS error with a working
CORS config almost always means the backend crashed. Check the uvicorn
terminal for the traceback rather than the CORS settings.

The same version also filtered `is_protected == 1` and then, for
non-superadmins, `is_protected == 0` on the same query — a contradiction
that can never match, so regular users would have received `[]` even
without the crash.

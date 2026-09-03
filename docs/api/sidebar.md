# Sidebar routes

*(`backend/app/api/admin/sidebar.py`)*

See [../API.md](../API.md) for the shared authentication header/error
format that applies to every route in this project, not just this one,
and [../ARCHITECTURE.md](../ARCHITECTURE.md)'s "Sidebar and menus"
section for how the menu tables fit together.

Two routes on one router now — `admin_sidebar` and `user_sidebar` — each
reading a different table with a different access model.

---

## `GET /admin_sidebar`

Returns the built-in admin modules, for the "Admin Menu" section of the
sidebar. Reads `adm_modules` — active, protected rows, in `id` order.

**Auth:** any authenticated user — but note *how*. The route signature is
`admin_sidebar(db: Session = Depends(get_db))` with **no auth dependency
at all**, so `RequireAuthMiddleware` is the only thing checking the token
here, same as before. That also means the route body has no `User`
object to read: every authenticated caller gets the same list. The
frontend gates whether this section renders at all on
`user.is_superadmin` (`AppSidebar.jsx`), not this route.

**Response** `200 OK`

```json
[
  {
    "id": 3,
    "name": "Users Management",
    "icon": "fa fa-users",
    "path": "users",
    "is_protected": 1
  }
]
```

Only rows with `is_active = 1 AND is_protected = 1` are returned. Shape
is `schemas.ModuleOut` (`backend/app/schemas/admin/module.py`) — no
`slug`, no `sorting`, no `parent_id`: `adm_modules` doesn't carry those
columns, unlike `adm_menuses` below.

---

## `GET /user_sidebar`

Returns the caller's own menu tree, one level deep, for the "Menu"
section of the sidebar. Reads `adm_menuses`, scoped to the caller's role.

**Auth:** `Depends(auth.get_current_user)` — the first route on this
router to take one, because it needs `current_user.id_adm_role` to
filter by.

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "name": "Reports",
    "type": "Route",
    "path": "reports",
    "slug": "reports",
    "icon": "fa fa-chart-bar",
    "color": null,
    "sorting": 1,
    "parent_id": null,
    "children": null
  }
]
```

Filtered to `is_active = 1`, `is_dashboard = 0`,
`id_adm_role = current_user.id_adm_role`. Top-level rows
(`parent_id IS NULL`) are fetched first; for each one, a second query
fetches its own children (`parent_id = <that row's id>`, same
`is_active`/`is_dashboard`/`id_adm_role` filters) and attaches them as
`.children` — plain Python attribute assignment on the SQLAlchemy row,
not a declared relationship, which is why it works with no model change.
Only one level: a child's own `children` is never populated, matching how
deep Laravel's `CommonHelpers::sidebarMenu()` goes.

Shape is `schemas.MenuOut` (`backend/app/schemas/admin/menus.py`), which
is self-referential (`children: list["MenuOut"] | None`) — it needs
`MenuOut.model_rebuild()` at import time for Pydantic to resolve the
forward reference, or every response using it raises at construction.

`Dashboard` has no row here and never will — `is_dashboard = 0` excludes
it explicitly, since the frontend hardcodes that link (`AppSidebar.jsx`
always shows it first, before mapping this response).

---

## Changed on 2026-09-03

`adm_admin_menuses` — the table `/admin_sidebar` read as of the
2026-08-30 change below — is gone, migration and seeder included. Rather
than resurrect it, `/admin_sidebar` was repointed at `adm_modules`
(already seeded, already the source of truth for what a module *is*),
and `/user_sidebar` was added as a new route to actually serve
`adm_menuses` — which existed in the schema before this change but had
no route reading it at all.

| | Before (2026-08-30) | After (2026-09-03) |
|---|---|---|
| `/admin_sidebar` table | `adm_admin_menuses` | `adm_modules` |
| `/admin_sidebar` response schema | `AdminMenu` (deleted) | `ModuleOut` |
| `/user_sidebar` | did not exist | reads `adm_menuses`, role-scoped, 1 level deep |
| Role scoping | none on either route | `/user_sidebar` filters by `id_adm_role`; `/admin_sidebar` still doesn't |
| Router tag | `"admin_sidebar"` | `"sidebar"` — one router, two routes now |

**`/admin_sidebar` role scoping is still gone**, same gap the
2026-08-30 entry below described for the table it used to read:
`adm_modules` has no `id_adm_role` column, so there's nothing to filter
on. That's unchanged behavior, not a regression from this change.
`/user_sidebar`, the new route, *is* role-scoped — `adm_menuses` was
always the table with the `id_adm_role` column, it just had no route
until now.

`MenuOut` and `Menuses` — described as "no route serves either of them
right now" in the entry below — are what `/user_sidebar` serves.

### The password-hash lesson generalizes

Building `/user_sidebar`'s privilege check surfaced the same class of
gap the module system has (see
[MODULES.md](../MODULES.md#where-the-trust-boundaries-are)): a route
that selects real columns off a real table has no automatic guard
against selecting a sensitive one. `MenuOut` doesn't touch anything
sensitive, so this route has no instance of the bug — worth naming
anyway, since `users_module.py`'s form fields do have one right now (see
[MODULES.md](../MODULES.md#known-gaps)).

---

## Changed on 2026-08-30

This route was `GET /sidebar` earlier the same day. What moved:

| | Before | After |
|---|---|---|
| Path | `/sidebar` | `/admin_sidebar` |
| Table | `adm_menuses` joined to `adm_modules` | `adm_admin_menuses` |
| Response schema | `MenuOut`, which then nested a `module` object | `AdminMenu` (flat, adds `parent_id`) |
| Role scoping | non-superadmins saw only their own `id_adm_role` | none — every authenticated caller gets the same list |

**Role scoping was gone as of this change**, and that was a behaviour
change rather than a refactor: `adm_admin_menuses` had no `id_adm_role`
column, so there was nothing to filter on. The 2026-09-03 change above
closed this back up for menus (`/user_sidebar` is role-scoped) but not
for modules (`/admin_sidebar` still isn't) — `adm_modules` still has no
`id_adm_role` column either.

`MenuOut` and `adm_menuses` were both still in the codebase as of this
entry, and both changed shape the same day — `MenuOut` dropped its
nested `module` field for a flat `parent_id`, matching
`adm_menuses.patent_id` becoming a self-referencing `parent_id`
(migration `253f97ec1dfd`, see
[../MIGRATIONS.md](../MIGRATIONS.md#this-projects-migration-history)).
**No route served either of them as of this entry** — that's what
`/user_sidebar` (2026-09-03, above) closed.

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

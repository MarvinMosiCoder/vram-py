# Sidebar routes

*(`backend/app/api/sidebar.py`)*

See [../API.md](../API.md) for the shared authentication header/error
format that applies to every route in this project, not just this one,
and [../ARCHITECTURE.md](../ARCHITECTURE.md)'s "Sidebar and menus"
section for how `adm_modules`/`adm_menuses` fit together.

---

## `GET /sidebar`

Returns the menu entries the current user should see, for building the
sidebar dynamically. Each entry carries its parent module, which is how
the frontend decides where to render it (see `Sidebar.jsx`'s
`is_protected` grouping).

**Auth:** any authenticated user. A superadmin (`adm_roles.is_superadmin == 1`)
sees every active menu; anyone else only sees menus tagged with their
own `id_adm_role`. Menus whose parent module is inactive, or that are
themselves inactive, are excluded either way.

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "name": "Users",
    "path": "/admin/users",
    "slug": "users",
    "icon": "fa fa-users",
    "color": null,
    "sorting": 1,
    "module": { "id": 1, "name": "Users Management", "icon": "fa fa-users", "path": "users", "is_protected": 1 }
  }
]
```

Ordered by `sorting`. Empty list (`[]`) if the user has no matching
menus — this is expected right now since `adm_modules`/`adm_menuses`
have no seeded rows yet.

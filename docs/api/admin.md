# Admin routes

*(`backend/app/api/admin.py`)*

See [../API.md](../API.md) for the shared authentication header/error
format that applies to every route in this project, not just this one.

---

## `GET /admin/users`

Lists every registered user. The route the frontend's "Total users"
dashboard card calls.

**Auth:** `require_role(1)` — Super Administrator only

**Response** `200 OK`

```json
[
  { "id": 1, "email": "admin@vram.com", "name": null, "theme_color": null, "role": "Super Administrator", "role_id": 1 }
]
```

**Errors:** `403` if the caller's `id_adm_role` isn't `1`.

# Editor routes

*(`backend/app/api/editor.py`)*

See [../API.md](../API.md) for the shared authentication header/error
format that applies to every route in this project, not just this one.

---

## `GET /editor/content`

Placeholder route for a future editor-specific area. No separate editor
role exists yet, so it's currently gated the same as Super Administrator.

**Auth:** `require_role(1)` — Super Administrator only (temporary)

**Response** `200 OK`

```json
{ "message": "Editor content area" }
```

**Errors:** `403` if the caller's `id_adm_role` isn't `1`.

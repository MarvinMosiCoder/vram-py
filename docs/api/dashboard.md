# Dashboard routes

*(`backend/app/api/dashboard.py`)*

See [../API.md](../API.md) for the shared authentication header/error
format that applies to every route in this project, not just this one.

---

## `GET /dashboard`

Example route open to any logged-in user regardless of role.

**Auth:** any authenticated user

**Response** `200 OK`

```json
{ "message": "Welcome admin@vram.com" }
```

# Auth routes

*(`backend/app/api/auth.py`)*

See [../API.md](../API.md) for the shared authentication header/error
format that applies to every route in this project, not just these.

---

## `POST /register`

Create a new user with no role assigned. Open to anyone (no auth
required) — this is a demo template, not a production-safe default.

**Request body** (`application/json`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string (email) | yes | must be unique |
| `password` | string | yes | stored as a bcrypt hash, never in plain text |

```json
{ "email": "new.user@vram.com", "password": "hunter2" }
```

**Response** `200 OK`

```json
{ "id": 4, "email": "new.user@vram.com", "name": null, "theme_color": null, "role": null, "role_id": null }
```

A role isn't assignable at registration time — it has to be set on the
`adm_users` row afterwards (there's no endpoint for this yet).

**Errors**

| Status | Cause |
|---|---|
| `400` | email already registered |
| `422` | validation error (e.g. malformed email, missing field) |

---

## `POST /login`

Exchange email + password for a JWT. Body is **form-encoded**, not
JSON — this endpoint uses FastAPI's `OAuth2PasswordRequestForm`, which
expects fields literally named `username` and `password` (send the
user's email as `username`).

**Request body** (`application/x-www-form-urlencoded`)

```
username=admin@vram.com&password=admin123
```

**Response** `200 OK`

```json
{ "access_token": "eyJhbGciOi...", "token_type": "bearer" }
```

The token embeds `sub` (email), `admin_id`, `user_name`, `theme_color`,
and `token_version` — the last one is what makes `/logout` able to
revoke a token immediately (see below).

**Errors**

| Status | Cause |
|---|---|
| `401` | no user with that email, or password doesn't match |

---

## `POST /logout`

Increments the user's `token_version` in the database. Every token
issued before this call embeds the old `token_version`, so
`get_current_user` rejects them on the next request — a real, immediate
revocation, not just "the client forgot its token."

**Auth:** any authenticated user

**Response** `200 OK`

```json
{ "message": "Logged out" }
```

---

## `GET /me`

Returns the profile of the currently authenticated user, resolved from
the JWT. Used by the frontend on page load to turn a saved token back
into a user object.

**Auth:** any authenticated user

**Response** `200 OK`

```json
{ "id": 1, "email": "admin@vram.com", "name": null, "theme_color": null, "role": "Super Administrator", "role_id": 1 }
```

`role` is the role's `name`; `role_id` is `adm_roles.id`. Both are `null`
if the user has no role assigned. `theme_color` comes from the user's
*role*, not the user row itself.

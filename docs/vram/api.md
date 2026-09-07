# API reference

The development backend normally runs at `http://localhost:8000`. Its `/docs`
and `/openapi.json` expose current static endpoint schemas. Dynamic controllers
accept bodies through a shared dispatcher, so their field metadata is the
additional contract for module requests.

## Authentication and static endpoints

Send `Authorization: Bearer <token>` for protected calls. Login accepts URL-encoded
`username` (email) and `password`, returning `access_token`. Token lifetime is
configured by `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60). There is no refresh route.

| Method | Endpoint | Purpose/access |
| --- | --- | --- |
| POST | `/register` | Public registration; see server schema for fields |
| POST | `/login` | Public credentials exchange |
| POST | `/logout` | Authenticated token-version revocation |
| GET | `/me` | Authenticated serialized user |
| GET | `/dashboard` | Authenticated welcome response |
| GET | `/admin/users` | User list, role ID 1 |
| GET | `/editor/content` | Content response, currently role ID 1 |
| GET | `/admin_sidebar` | Active protected modules, authenticated |
| GET | `/user_sidebar` | Authenticated role-scoped menu tree |
| GET | `/system/logo` | Public logo setting |
| GET | `/system/appname` | Public application name setting |

Profile endpoint contracts are maintained in [profile and navbar](profile-navbar.md).
Client login/logout behavior and incomplete permission enforcement are documented
in [admin processes](admin-processes.md), not implied by the access table above.

## Dynamic endpoints

Active module paths resolve through `GET|POST /{module_path}[/{action}[/{rest}]]`.
These routes require authentication; capability checks belong to handlers.

| Operation | Method/path | Body or result |
| --- | --- | --- |
| List | `GET /<path>` | Module metadata, columns, rows, pagination, actions/form configuration |
| Add | `GET /<path>/add` | Index props plus create page mode |
| Edit | `GET /<path>/edit/<id>` | Index props plus edit mode and record |
| Create | `POST /<path>/store` | Configured form values |
| Update | `POST /<path>/update` | Form values and primary key (normally `id`) |
| Delete | `POST /<path>/delete` | Primary key |
| Bulk | `POST /<path>/bulk-action` | Consult controller's `post_bulk_action` body contract |
| Export | `POST /<path>/export` | Filename/format/limit plus supported query filters |

## List query parameters

| Parameter | Behavior |
| --- | --- |
| `search` | Case-insensitive matching across configured search columns |
| `page` | Page number, minimum 1 |
| `per_page` | Controller default, clamped to 1-100 |
| `sort_by` | Declared sortable column; unknown values do not enable arbitrary SQL |
| `sort_dir` | `desc` for descending, otherwise ascending |
| Declared filter column | Text matching or typed equality as implemented by the base helper |

Exports reuse the module query without normal pagination. CSV is built in; XLSX
requires openpyxl; PDF is not ported. Custom endpoints can return different shapes.

## Response conventions

Base writes normally return `{ "message": "...", "status": "success" }`, with
an ID where applicable. Module overrides may differ: the current users save
methods return ORM objects. Do not assume every HTTP 200 means business success;
profile operations can return warning/error status JSON.

| HTTP status | Typical cause |
| --- | --- |
| 400 | Custom validation such as users required fields or duplicate email |
| 401 | Missing, invalid, expired, or revoked token |
| 403 | Role restriction or denied capability |
| 404 | Inactive/missing module, unavailable action, wrong action arguments, missing record |
| 422 | Validation failure or invalid operation payload |
| 500 | Unregistered controller, invalid table/column configuration, unhandled server failure |

FastAPI errors use `detail` (string, validation array, or field dictionary).
Some handlers use `errors` or `message`. Normalize these for toasts while retaining
field errors. For file requests, decode JSON Blob errors before displaying them.
See [notifications](notifications.md) for rendering conventions.

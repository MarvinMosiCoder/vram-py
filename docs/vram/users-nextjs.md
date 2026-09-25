# Users conversion reference

Users now runs in `frontend-next`, using the original React table, form layout,
theme tokens, and shared admin shell. The backend remains FastAPI.

## Run and inspect

1. Follow [operations](operations.md) to start FastAPI on port 8080 and Next.js
   on port 3000. Allow `http://localhost:3000` in backend CORS configuration.
2. Sign in, then open `/users`. Search, sortable headings, pagination, View,
   Export, Refresh, New, and Edit use the shared generated module component.
3. New opens `/users/add`. Fill Name, Email, Role, and Password, then Save.
4. Edit opens `/users/edit/<id>`. The role is preselected. Leave New password
   blank to omit it from the update payload, preserving the existing password.
   Validation errors remain on the form. The existing API returns a role name;
   the form matches it to the metadata options to preselect the role. If names
   are ambiguous, select the role explicitly.
5. Editing your own email or password signs you out after saving. Sign in with
   the updated credentials. Failed form loads show Retry and cannot be submitted.

Use test accounts when exercising saves yourself: these operations write to the
configured database. The automated browser smoke test mocks the API instead.

## Where code belongs

Paths below are relative to `frontend-next/`:

| File | What to learn |
| --- | --- |
| `app/(admin)/layout.tsx` | Shared by all admin routes: authentication, theme/sidebar providers, and the shell |
| `app/(admin)/users/page.tsx` | A page component selects its feature component |
| `app/(admin)/users/add/page.tsx` | Reuse the form in create mode |
| `app/(admin)/users/edit/[id]/page.tsx` | Await Next.js params and pass the validated ID into the client form |
| `components/users/UsersPage.tsx` | Wrap the generated list; customize role display and hide password in View |
| `components/users/UserForm.tsx` | Client state, loading, dropdown options, validation, whitelisted payloads, save, navigation |
| `components/modules/GeneratedModulePage.tsx` | Shared metadata-driven table, panels, exports, bulk actions, and extension hooks |
| `types/modules.ts` | API metadata, action descriptors, and wrapper hook contracts |
| `components/form/`, `components/table/`, `components/panel/` | Reusable controls retaining the React classes |
| `lib/http.ts`, `lib/api-errors.ts` | Authenticated Axios client and API error normalization |

Only interactive components need `"use client"`. The small route pages compose
them. There is no `legacy` directory. `(admin)` is a route group: its name is not part
of the URL, so `app/(admin)/users` still serves `/users`. `[id]` means a
dynamic URL segment: `/users/edit/2` supplies `id = "2"`.

For another generated module, add its route under `app/(admin)/`, then render
`<GeneratedModulePage modulePath="your-path" />`. Put custom behavior in a
feature wrapper, not in the shared runtime. Create add/edit pages when the
controller enables `use_add_route`/`use_edit_route`; otherwise forms open inline.

## Why the backend folder is called modules

`backend/app/modules/admin/users_module.py` is a feature controller. The folder
name describes backend organization; it does not determine the frontend route
and is unrelated to npm's `node_modules`.

The connection is:

1. The browser sends an authenticated request through `lib/http.ts` to port 8080.
2. `backend/app/api/dynamic.py` resolves the active `adm_modules` row whose path
   is `users` and whose controller is `UsersController`.
3. `backend/app/modules/registry.py` discovers the decorated controller.
4. The controller and `generated_module.py` query `adm_users`/`adm_roles` and
   return JSON. Next.js renders that JSON.

| Request | Behavior |
| --- | --- |
| `GET /users` | Columns, rows, pagination, fields/options, and permitted actions |
| `GET /users/add` | Create metadata; requires create capability |
| `GET /users/edit/<id>` | Generated edit metadata and `editRow` containing the declared list columns, including role name |
| `POST /users/store` | Accept name, email, role ID, and required plaintext password |
| `POST /users/update` | Existing custom save action; the frontend omits a blank password |

No backend code was changed for this conversion. `UsersController` continues
to extend `ModuleController` from `helpers/generated_module.py`. Its existing
custom saves return ORM objects rather than the standard message envelope, so
the Next.js form supplies fallback success text. Existing 400 `detail` strings
appear as form errors; field dictionaries are supported too. The frontend sends
only editable fields and the update ID, excluding joined list metadata.

## Checks

From `frontend-next/`, run `npm run lint` and `npm run build`. For browser checks,
start `npm run start -- --port 3100`, make Playwright and Chrome available, and run
`node tests/users-smoke.cjs`. If Playwright is installed elsewhere, set
`PLAYWRIGHT_MODULE` to that package path. The script intercepts all port-8080 API
requests and checks desktop/mobile flows without writing real users.

Roles, menu management, profile pages, and password/announcement gates still
need migration; the [status table](frontend.md#migration-status) tracks coverage.

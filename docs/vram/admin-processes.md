# Admin processes

## Login and logout

1. Open `/login` and enter email/password.
2. Client validation reports missing or invalid input through the styled login toast.
3. AuthContext posts form-encoded credentials to `/login`, stores the access token,
   then requests `/me` for identity and role information.
4. Successful login navigates to `/dashboard`; protected pages require an authenticated user.
5. The navbar Logout action opens a confirmation dialog. Current client logout
   clears local token/user state. Although the backend exposes `POST /logout`
   for token-version revocation, AuthContext does not currently call it.

Password-reset JSX files remain legacy Inertia components and are not connected
to the current App routes. Do not present them as a working recovery flow.

## Users

Open `/users`; use `/users/add` or `/users/edit/<id>` for the custom forms.
Enter name, email, role, and password as required by the form. Role choices come
from server form metadata. Save posts to `/users/store` or `/users/update`.
The edit form omits an empty password. Successful saves notify and return to
the list; validation messages remain near fields and request failures show a toast.

`UsersController` has custom save methods: they check required values and email
uniqueness, hash a supplied password, and return an ORM user rather than the
standard `{message, status}` envelope. The frontend therefore has fallback copy.
These overrides bypass the base CRUD mutation lifecycle; audit their permissions
and serialization separately when changing them.

## Roles and permissions

Open `/roles`, then Add Role or edit an existing role. Set name, superadmin flag,
and theme. The form loads module permission flags through `/roles/module/<id>`
and submits them with the role to `/roles/store` or `/roles/update`. Role names
are checked for duplicates; creating a superadmin role is restricted in validation.
The controller saves submitted flags to `adm_roles_privileges`.

Saved flags are not yet fully enforced by the shared capability helper:
`_privilege()` still falls back to `PRIVILEGES_DEFAULT = True` for non-superadmins.
Do not equate the permission editor with complete per-role authorization.
The separate edit-permissions/save-permissions actions contain placeholder behavior.
Role deletion is disabled in the controller's declared actions.

## Menus and branding

The admin sidebar reads active, protected `adm_modules` rows from `/admin_sidebar`.
The frontend displays this section for superadmins. Normal navigation reads
`/user_sidebar`, filtering active, non-dashboard `adm_menus` rows by the current
role and sorting value, including one child level.

A module row enables routing; a menu row places a link in role-specific navigation.
They are separate concerns. The navbar reads branding through `/system/logo` and `/system/appname`,
which query settings with fallback values.

## Availability

| Feature | Current source status |
| --- | --- |
| Users and roles | Registered controllers and custom forms |
| Profile | Implemented API and `/profile` page; see [profile guide](profile-navbar.md) |
| Menu management | Sidebar reads work; `menus_module.py` is empty, so its seeded controller is not implemented |
| Notifications module | Registered demonstration actions; not a complete inbox or generated CRUD payload |
| Module generator | Python `generate()` helper exists; no registered ModulesController admin screen |
| Settings, API generator, email templates, statistics builder, logs | Seeded entries do not imply implemented controllers |

An active seeded row with no registered controller returns HTTP 500. Check
controller discovery before describing any sidebar item as a working feature.

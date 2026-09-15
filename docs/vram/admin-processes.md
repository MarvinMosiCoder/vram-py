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

## Change password

Open Change Password from the navbar account dropdown, or visit
`/change-password`. The form takes the current password, a new one, and a
confirmation, and enables its submit button only once the new password has an
uppercase letter, a number, a special character, at least 8 characters, and
matches the confirmation. A strength meter reports Weak/Strong/Excellent beside
the same rules. All of this is client-side gating of the button; the server
performs its own checks.

`POST /save-change-password` verifies the current password, then refuses a
password that appears in `adm_password_history` for that user, then writes the
new hash along with `last_password_updated` and `waiver_count = 0` - which is
what clears the [forced change](#forced-password-change). It appends a history
row afterwards. Note that the row stores the password just set, despite the
column being named `adm_user_old_pass`: history accumulates every password the
account has held, which is what makes the reuse check work on later changes.
A password set at account creation was never recorded, so it can be reused once.
This matches the Laravel original's `postUpdatePassword`.

Both outcomes return HTTP 200 with `{message, status}` and `status` of
`success` or `error`, so a failed change is not an HTTP error. The page reads
`status` rather than the status code.

On success the page shows the message, counts down from three in both the toast
and an inline banner, then clears the token; `ProtectedRoute` redirects to
`/login` once the user is null. `components/form/ChangePasswordForm.jsx` and
`hooks/useSignOutCountdown.js` hold the form and the countdown, shared with the
forced-change modal - the form reports success to its caller rather than
deciding what happens next, because the modal must not sign the user out after a
waiver.

`POST /check-password` still exists and reports whether a supplied password
matches the caller's current one. Nothing calls it: the forced-change screen
reads `is_default_password` from the policy instead.

## Forced password change

After `/me`, AuthContext requests `GET /password-policy` and stores the result.
`ForcePasswordGate` in `App.jsx` shows a non-dismissible modal whenever
`must_change` is set, ahead of the announcement gate; announcements wait until
the password is resolved, matching the order in Laravel's
`CheckUserForceChangePassword` middleware.

`must_change` is true when the stored hash matches the default password
`qwerty`, or the password is more than `PASSWORD_MAX_AGE_MONTHS` (3) calendar
months old. Changing the password clears both conditions, because
`save-change-password` writes `last_password_updated` and resets `waiver_count`.

| Field | Meaning |
| --- | --- |
| `must_change` | Default password, or older than three months |
| `is_default_password` | The hash matches `qwerty` |
| `can_waive` | Not the default password and fewer than `MAX_WAIVERS` (4) waivers used |
| `waivers_used`, `max_waivers` | Progress against the cap |

`POST /waive-change-password` stamps `last_password_updated` to today and
increments `waiver_count`, so waiving restarts the three-month clock and the
counter only advances the next time the password expires. The endpoint re-checks
both rules itself: the modal disables its Waive button, but the button is not
the enforcement.

The gate is a prompt, not a security boundary. The access token stays valid
while the modal is open, so the API remains reachable around it; a failed
policy read fails open rather than locking the account out of the admin.

Three deliberate differences from the Laravel original: a null
`last_password_updated` counts as expired here, where `Carbon::parse(null)`
resolves to "now" and silently exempts the user; the waiver cap compares `>=`
rather than the original's `=== 4`, which let a count of 5 waive again; and
`/check-waive` is not ported, since its inverted boolean `status` is folded into
`can_waive`.

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
`/user_sidebar`, filtering active, non-dashboard `adm_menuses` rows by sorting
value and including one child level.

Role visibility comes from the `adm_menus_roles` pivot, not from a column on the
menu row: `/user_sidebar` keeps only menus whose id appears in that table for the
caller's role. This is Laravel's `adm_menus_privileges`, renamed because
`privileges` in this port already means the module permission flags in
`adm_roles_privileges` - a different relationship with a different grain.
`adm_menuses.id_adm_role` still exists and still holds the pre-pivot value, but
nothing reads it; it is scheduled for removal once the menu screen is complete.

A menu is top level when `parent_id` is `NULL`. Laravel writes `0` for the same
thing, so porting that literally empties the sidebar with no error.

A module row enables routing; a menu row places a link in role-specific navigation.
They are separate concerns. The navbar reads branding through `/system/logo` and `/system/appname`,
which query settings with fallback values.

## Menu management

`/menus` is a custom page, not a generated module: the screen is a list of menu
cards with their role assignments, so it declares no `table_fields` and never
reaches the shared CRUD engine. `MenusController.get_index` returns
`page_title`, `roles` (`{value, label}` options), `menus` (active top-level rows,
each with a one-level `children` list and a `roles` list of `{id, name}`), and
`inactive_menus` (no children). `frontend/src/pages/modules/menus/index.jsx`
renders it; the file's own path is its registration, through the
`import.meta.glob` in `modulePages.js`.

Implemented so far is the read only. Create, edit, reorder and delete are not
written, and the card's pencil button is inert. The Laravel original
(`MenusController.php` plus `MenuManagement.jsx`) additionally has
`createMenu`, `updateMenu`, `autoUpdateMenu` drag ordering and `editMenu`.

Its menu type is limited to `Route` and `URL`, matching the current Laravel
form. `CommonHelpers::sidebarMenu()` also resolves `Module`, `Statistic` and
`Controller & Method`, which come from the application Laravel was itself ported
from; this port implements none of them, and `UserSidebar.jsx` does not yet
branch on type at all - it builds an internal path for every menu, so a `URL`
menu would not resolve correctly.

## Availability

| Feature | Current source status |
| --- | --- |
| Users and roles | Registered controllers and custom forms |
| Profile | Implemented API and `/profile` page; see [profile guide](profile-navbar.md) |
| Change password | Implemented API and `/change-password` page, with history reuse checks |
| Forced password change | Implemented policy endpoint, waiver endpoint and client gate; the gate is a prompt, not server enforcement |
| Menu management | Sidebar reads work. `MenusController` implements `get_index` only, and `/menus` renders a read-only list; no create, edit, reorder or delete exists yet |
| Notifications module | Registered demonstration actions; not a complete inbox or generated CRUD payload |
| Module generator | Python `generate()` helper exists; no registered ModulesController admin screen |
| Settings, API generator, email templates, statistics builder, logs | Seeded entries do not imply implemented controllers |

An active seeded row with no registered controller returns HTTP 500. Check
controller discovery before describing any sidebar item as a working feature.

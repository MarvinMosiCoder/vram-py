# Admin processes

## Next.js migration coverage

`frontend-next/` implements login, session restoration, the original dashboard
cards, and the shared React admin shell with role themes, backend-loaded menus,
and logout confirmation. AuthProvider fetches password policy and announcements,
but their gates are not ported. Logout clears local state without calling the
backend logout helper. Users list/view/add/edit and the generated runtime are
migrated; other module pages remain in the Vite app. See the [Users guide](users-nextjs.md).

The workflows and availability table below describe legacy `frontend/` and the
shared FastAPI backend. They do not establish Next.js screen availability.
See [migration status](frontend.md#migration-status) for current coverage.

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
the list; validation messages remain near fields and request failures are visible.

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
`adm_menuses.id_adm_role` remains as a legacy column; new menus set it to 1.
Sidebar visibility reads the pivot rather than this column.

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

Listing, creation, editing, role assignment, reordering, and moves between
top-level and child groups are implemented. The page shows active and inactive
sections alongside an Add menu form; the pencil opens an edit modal. Delete is
disabled. See [creating and editing menus](#creating-and-editing-menus) for save
behavior and the remaining UI limitations.

### Reordering

Cards use native browser drag events. `index.jsx` renders insertion gaps between
cards and beneath empty parents. Each gap reserves 8 pixels even when idle,
and empty child areas remain mounted so starting a native drag never shifts the
source card. Cards disable text selection to keep labels draggable. An absolute
accent line and destination label mark the active gap without taking extra space.
Rows include a grip indicator; indented children share a vertical guide line,
and parents display their child count. Cards also accept drops: their upper/lower halves select
before/after gaps. Root targets default to top-level ordering; moving at least
32 pixels right from the drag start selects a child destination when allowed.
Invalid nesting on a root target falls back to root ordering. Child gaps select
an exact insertion position within that parent. Root menus with children can be
reordered but cannot be nested, because only one child level is supported.

`dragFrom` stores the source parent and index. Hover changes only `dropTarget`;
the menu tree changes on drop. Gap indices are measured before removal, so a
same-group downward move subtracts one from the insertion index. Cards and child
groups are copied rather than mutated, preserving the rollback snapshot.

`POST /menus/move` takes `{menu_id, parent_id, ids}`. `parent_id` is null for
top level; `ids` is the complete destination order after the move. The handler
checks update capability, input types, duplicate IDs, the moved record, and the
destination group. It rejects self-parenting, inactive/dashboard destinations,
and nesting a menu that has children (including inactive children). It changes
`parent_id`, renumbers destination and remaining source siblings, and commits
once. Existing capability-helper limitations still apply.

Saving is optimistic. A failed request restores the previous tree and shows the
server's error when available. A ref blocks another drag during a pending save;
the page also disables dragging and displays a saving status. Move requests time
out after 15 seconds. Since a timed-out write may have committed, the page reloads
the server order (with a 10-second read timeout) before enabling another move.
If that read also fails, a page error asks the user to refresh when the server
is available. The save lock is released in all settled request paths.

Its menu type is limited to `Route` and `URL`, matching the current Laravel
form. `CommonHelpers::sidebarMenu()` also resolves `Module`, `Statistic` and
`Controller & Method`, which come from the application Laravel was itself ported
from; this port implements none of them, and `UserSidebar.jsx` does not yet
handle external URLs - it uses type to choose a link or child group, but builds
internal paths for links, so a `URL` menu would not resolve correctly.

### Creating and editing menus

The Add menu form and edit modal share `MenuFormFields`, built with `TextInput`,
`SelectInput`, and `InputError`. Both expose roles, name, path, icon class, type
(`Route` or `URL`), slug, and Active (`1` for ACTIVE, `0` for INACTIVE). Name is
required by the browser. Choose an explicit status when adding: the initial
form sends an empty string, which does not trigger the backend's default of 1.

The pencil copies the selected record into `editForm`; cancel discards the draft.
Although the modal shows a slug input, `openEdit` does not copy the existing slug,
so it initially appears blank. Leaving it untouched omits it from the update;
changing it sends the new value. `is_dashboard` is copied but has no form control.

#### Role options and selected roles

Both list requests run on mount; either failure shows "Could not load menus".
`GET /menus` checks view capability. The separate authenticated
`GET /menus/roles` sorts all roles by name and has no additional capability check.

| Source | Shape | Frontend use |
| --- | --- | --- |
| `GET /menus` | Object with `roles: [{value, label}]` | Included in page data |
| `GET /menus/roles` | `[{value, label}]` | Populates selector options directly |
| Each listed menu's `roles` | `[{id, name}]` | Copied into the edit draft |

The multi-select matches IDs as strings and maps selections back to `{id, name}`.
Empty selection becomes `[]`. Role visibility is saved in `adm_menus_roles`.

#### Save contracts

Both saves use a 15-second timeout and return `{message, status, menu}` on success.
The `menu` is an ORM row encoded by FastAPI, not the enriched `_serialize()`
result used by the list endpoint: it does not include `roles` or `children`.

`POST /menus/add` checks create capability and accepts `name`, `type`, `path`,
`slug`, `icon`, `is_active`, and `roles` (objects with an `id`). It rejects an
existing exact name with HTTP 400 and `detail: {message, status}`. It creates a
top-level menu (`parent_id` remains null), forces `is_dashboard = 0` and the
legacy `id_adm_role = 1`, and inserts role assignments in the same transaction.
It does not assign `sorting`; reorder afterwards to establish its position.
Insert failures roll back and return HTTP 500 with a message in `detail`.

`POST /menus/update` checks update capability and requires the menu `id`.
A missing record returns HTTP 422. It applies supplied attributes that exist on
the model, excluding `id` and `roles`, then adds/removes pivot rows to match the
submitted role IDs and commits. Omitting `roles` clears all assignments. This is
not a validated field allowlist: the handler does not enforce required fields,
unique names, allowed type/status values, or role payload structure. Existing
capability-helper limitations still apply to both writes.

On success, Add resets its form and appends the returned row to the active list;
Edit merges the returned row into the existing active/inactive card and closes
the modal. Both show a success toast. Object-shaped `detail` errors are retained
for field messages, with `detail.message` used for the toast. Edit inputs and
modal dismissal are disabled while saving; Add disables its buttons but leaves
its fields editable.

#### Current UI limitations

- Reload after saving to refresh role labels and active/inactive placement. Save
  responses omit roles, and the page does not refetch or move cards between
  sections after a status change; even a new inactive menu is appended to active
  menus until reload. The sidebar also fetches only on mount.
- The inactive section contains only top-level rows, without children. Inactive
  children are excluded from the active tree and are not listed separately.
- Inactive cards reuse drag controls, but those handlers index the active tree.
  Dragging them can target an active menu instead. Inactive reordering is not
  supported by `/menus/move`; use dragging only in the active section. A failed
  move also assigns the active rollback snapshot to the inactive list; reload
  to restore that display.
- Delete has no menu-management UI and is disabled in controller actions.

## Availability

| Feature | Current source status |
| --- | --- |
| Users and roles | Registered controllers and custom forms |
| Profile | Implemented API and `/profile` page; see [profile guide](profile-navbar.md) |
| Change password | Implemented API and `/change-password` page, with history reuse checks |
| Forced password change | Implemented policy endpoint, waiver endpoint and client gate; the gate is a prompt, not server enforcement |
| Menu management | Listing, role options, sibling ordering, promotion, nesting of menus without children, and cross-parent child moves are implemented. Creation, editing, and role-pivot saves are implemented; status/role display refresh and inactive dragging have limitations described above. Delete is disabled |
| Notifications module | Registered demonstration actions; not a complete inbox or generated CRUD payload |
| Module generator | Python `generate()` helper exists; no registered ModulesController admin screen |
| Settings, API generator, email templates, statistics builder, logs | Seeded entries do not imply implemented controllers |

An active seeded row with no registered controller returns HTTP 500. Check
controller discovery before describing any sidebar item as a working feature.

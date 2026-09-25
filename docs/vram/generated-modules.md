# Generated modules

The backend generation workflow remains shared. The typed generated runtime is
now at `frontend-next/components/modules/GeneratedModulePage.tsx`. Users is the
first migrated module; see the [Users conversion guide](users-nextjs.md) for a
complete route, form, and backend reference. Creating a controller does not
create a Next.js page. Vite's automatic page discovery only applies to `frontend/`.

## Add a module

1. Define the database table/model and apply its Alembic migration.
2. Create a controller in `backend/app/modules/admin/` extending ModuleController.
   Declare table, key, table/form fields, search columns, and permitted actions.
3. Register the class with `@controller("ExactControllerName")` and create the
   matching active `adm_modules` row with a valid lowercase path.
4. Discovery imports controller files automatically. Restart the backend if it
   is not running with reload enabled.
5. Create `frontend-next/app/(admin)/<path>/page.tsx`, rendering
   `<GeneratedModulePage modulePath="your-path" />`. The shared
   `app/(admin)/layout.tsx` supplies authentication and the admin shell, so the
   module needs no layout of its own. When enabling separate add/edit routes, create those pages too, following Users.
6. Visit `/<path>`. Add a role-specific menu row if needed; protected active
   module rows already feed the admin sidebar.
7. Put custom client wrappers in `frontend-next/components/<feature>/`.

`module_generator.generate(db, name, path, table_name, ...)` can generate editable
controller metadata and its module row. Inspect its output before use. The helper
is not evidence of a working `/modules` management screen.

## Runtime workflow

See the [API reference](api.md#dynamic-endpoints) for requests and responses.
Controller configuration and hook signatures live in the
[module extension reference](module-reference.md).

## Customize one module

Prefer controller field/row metadata, then wrapper hooks such as `renderCell`,
`renderFormField`, `renderBeforeForm`, `buildSubmitPayload`, and `onFormSubmit`.
Use `onToast` to override a wrapper's notifications. Do not edit the shared
GeneratedModulePage for one module's design. Next.js routes are explicit `app/`
page files; there is no Vite glob or React Router registration in Next.js.

Preserve search, sort, pagination, validation, and reload behavior when replacing
submission. Declared actions govern generated buttons, but custom endpoints must
also enforce their own access. See [admin limitations](admin-processes.md).


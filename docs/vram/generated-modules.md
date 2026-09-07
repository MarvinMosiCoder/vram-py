# Generated modules

## Add a module

1. Define the database table/model and apply its Alembic migration.
2. Create a controller in `backend/app/modules/admin/` extending ModuleController.
   Declare table, key, table/form fields, search columns, and permitted actions.
3. Register the class with `@controller("ExactControllerName")` and create the
   matching active `adm_modules` row with a valid lowercase path.
4. Discovery imports controller files automatically. Restart the backend if it
   is not running with reload enabled.
5. Visit `/<path>`. Add a role-specific menu row if needed; protected active
   module rows already feed the admin sidebar.
6. Add a wrapper at `frontend/src/pages/modules/<path>/index.jsx` only for custom UI.

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
GeneratedModulePage for one module's design. Custom pages are discovered from
files; there is no route-registration list to extend for every module.

Preserve search, sort, pagination, validation, and reload behavior when replacing
submission. Declared actions govern generated buttons, but custom endpoints must
also enforce their own access. See [admin limitations](admin-processes.md).


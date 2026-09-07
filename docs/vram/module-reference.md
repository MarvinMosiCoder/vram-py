# Module extension reference

Use [generated modules](generated-modules.md) for the setup workflow and
[API](api.md#dynamic-endpoints) for request/response conventions. The definitive
implementation is `backend/app/helpers/generated_module.py`.

## Controller configuration

| Property | Responsibility |
| --- | --- |
| `table_name`, `primary_key` | SQLAlchemy table and record identity |
| `table_fields` | Visible columns, labels, joins, and presentation metadata |
| `form_fields` | Editable columns, input types, validation, select metadata |
| `search_columns`, `default_sort`, `per_page` | List query defaults |
| `actions` | Declared view/create/edit/delete and custom capabilities |
| `index_buttons` | Built-in add/export/refresh/bulk toolbar controls |
| `custom_index_buttons`, `custom_row_actions` | Additional action descriptors |
| `bulk_actions`, `custom_bulk_actions` | Bulk availability and named operations |
| `use_add_route`, `use_edit_route` | Form routing behavior |
| `has_created_at`, `has_updated_at` | Timestamp handling |

Foreign-key form controls can declare `table`, `value_field`, and `display_field`
for server-resolved options. Joined display columns use `select` plus `join` keys
`table`, `first`, and `second`. Check `users_module.py` for its role dropdown/join.
Keep columns, sort targets, filters, and exports allowlisted.

## Backend hooks

| Hook | Use |
| --- | --- |
| `custom_index_query(stmt)` | Add query scoping |
| `index_row(row)` | Transform serialized row data |
| `row_index(row)` | Per-cell presentation merged into `__rowIndex` |
| `before_store(payload)`, `before_update(payload, id)` | Transform validated payload |
| `after_store(payload, id)`, `after_update(payload, id)` | Post-write side effects |
| `before_delete(id)`, `after_delete(id)` | Delete-specific behavior |
| `before_bulk_delete(ids)`, `after_bulk_delete(ids)` | Bulk-delete behavior |
| `before_bulk_status_update(ids, payload, is_active)` | Transform bulk-status payload |
| `after_bulk_status_update(ids, payload, is_active)` | Bulk-status side effects |
| `handle_custom_bulk_action(ids, name, config)` | Implement declared custom operations |

The base payload selects configured fields and omits `None`; explicitly clearing
nullable fields may need an override. After hooks do not provide an automatic
transaction around dependent writes. Custom mutation methods replacing base
handlers must preserve their own validation, authorization, and serialization.
Only methods marked `@action` are routable.

## Frontend wrapper props

| Prop | Use |
| --- | --- |
| `modulePath`, `title` | Override routing source or heading |
| `renderCell(row, column, defaultCell)` | Customize individual cells |
| `renderBeforeTable(data)`, `renderAfterTable(data)` | Content around the table |
| `indexButtons`, `actions`, `moduleAccess`, `bulkActions` | Restrict available controls |
| `customIndexButtons`, `customIndexButtonHandlers` | Extra toolbar controls/handlers |
| `customRowActions`, `customRowActionHandlers` | Extra record actions/handlers |
| `useAddRoute`, `useEditRoute` | Override form routing |
| `renderFormField(name, config, ctx)` | Replace a field; return undefined for default |
| `renderBeforeForm(ctx)`, `renderAfterForm(ctx)` | Extra form content |
| `renderFormActions(ctx)`, `hideDefaultFormSubmit` | Customize form footer |
| `buildSubmitPayload(values, ctx)` | Reshape submitted values |
| `onFormSubmit(ctx)` | Own the complete submission flow |
| `onToast(message, status)` | Own this wrapper's notifications |

Form context supplies `mode`, `values`, `row`, `errors`, `busy`, `data`, `setValue`,
`close`, `reload`, and `toast`. Permission masks should only remove capabilities.

Custom row descriptors support label/action/icon/url/method/confirm/payload,
`visibleWhen`, `newTab`, and `reload`. URL placeholders resolve from the row.
A link action navigates with React Router; a POST action uses the API. Custom
handlers take precedence. Preserve the server's access and record-state checks
when hiding or replacing buttons.

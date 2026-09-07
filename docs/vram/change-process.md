# Admin change process

1. Read this folder's relevant guide and inspect the actual owners on both sides
   of the API. Compare the local Laravel source when porting its behavior.
2. Check the working tree and preserve unrelated edits, uploads, and migrations.
3. Decide whether the change is shared behavior or a module-specific override.
4. Prefer existing metadata, shared controls, and extension hooks.
5. Preserve response shapes, validation, navigation, and server access checks.
6. Verify the affected behavior and update the relevant guide plus changelog.

| Change | Verification |
| --- | --- |
| Frontend | Production build and affected interaction when a browser is available |
| Colors/layout | Light/black, desktop/mobile, focus and readable states |
| API mutation | Success, validation failure, missing record, denied access |
| Profile/files | Upload limits, apply/delete/download, navbar update, error response |
| Modules | Search/sort/page, add/edit, declared actions, export if affected |
| Documentation | Local links resolve and statements match current source |

Document only observed work. Distinguish implemented features from seeded rows,
placeholder actions, and Laravel-only behavior. State when checks were limited
to a build or source inspection. Do not imply browser/API testing happened when
it did not.

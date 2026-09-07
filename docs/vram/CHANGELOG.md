# Admin documentation changelog

## Unreleased

### Added

- Created `docs/vram/` as the admin workflow documentation hub, with architecture,
  admin processes, generated modules, profile/navbar, themes, response notifications,
  operations, and change-process guides.

### Changed

- Consolidated project documentation under `docs/vram/`; removed duplicate root
  guides, the superseded design spec, and repeated API feature pages.
- Replaced obsolete setup instructions with the current environment-based
  configuration and reviewed migration workflow.
- Kept module extension details, API contracts, and Laravel correspondence in
  dedicated references; simplified project entry points.

## Baseline - 2026-09-07

Recorded from the current working tree; this is not a reconstructed release history.

- React/FastAPI admin shell with generated module routing and users/roles forms.
- Shared React Toastify provider; login notifications have charcoal styling and
  colored success/error icons.
- Profile response handling and shared navbar image updates without browser reloads.
- Black theme uses login charcoal surfaces with mint-green accents.
- Documented incomplete privilege enforcement, placeholder modules, legacy password
  recovery components, and the difference between local logout and backend revocation.

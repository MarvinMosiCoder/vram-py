import RolesPage from "./admvram/RolesPage";

// adm_modules.path -> the page component that owns it.
//
// This is the React answer to Inertia resolving a controller's $viewName
// to a component. A module with NO entry here still works: ModuleRoute
// falls back to GeneratedModulePage, so a newly registered module needs
// no frontend change at all. Add a line here only when a module needs
// custom rendering.
export const MODULE_PAGES = {
  roles: RolesPage,
};

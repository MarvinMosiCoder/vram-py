// adm_modules.path -> the page component that owns it.
//
// THE FILESYSTEM IS THE REGISTRY. This used to be a hand-written map with
// one import line per module, so every new page grew both this file and
// App.jsx. import.meta.glob is the same trick the Laravel original uses to
// resolve an Inertia page name (resources/js/app.jsx:
// import.meta.glob("./Pages/**/*.jsx", { eager: true })), and the frontend
// twin of registry.discover() on the backend: dropping a file in registers
// it, deleting it unregisters it.
//
// A page's key is its path under modules/, which is deliberately the same
// string as the URL and as the backend action:
//
//   pages/modules/roles/index.jsx            -> "roles"
//        /roles                              -> RolesController.get_index()
//   pages/modules/roles/edit-permissions.jsx -> "roles/edit-permissions"
//        /roles/edit-permissions/7           -> get_edit_permissions("7")
//
// A module with NO file here still works: ModuleRoute falls back to
// GeneratedModulePage, so a newly registered module needs no frontend
// change at all. Add a file only when a module needs custom rendering.
//
// Eager on purpose, matching the original -- this is an admin bundle, and
// eager keeps resolution synchronous. Swap to a lazy glob + React.lazy in
// ModuleRoute if the bundle ever needs splitting per module.
const files = import.meta.glob("./modules/**/*.jsx", { eager: true });

export const MODULE_PAGES = Object.fromEntries(
  Object.entries(files)
    // A file that exports no component is a helper living alongside the
    // pages, not a page -- skip it rather than registering `undefined` and
    // failing at render time.
    .filter(([, mod]) => typeof mod.default === "function")
    .map(([file, mod]) => [
      file
        .replace("./modules/", "")
        .replace(/\.jsx$/, "")
        // index.jsx is the module's own page: roles/index -> roles.
        .replace(/\/index$/, ""),
      mod.default,
    ])
);

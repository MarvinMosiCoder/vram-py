import GeneratedModulePage from "../../admvram/vramjsx/GeneratedModulePage";

// The Roles module's own page. Laravel's equivalent is
// resources/js/Pages/Roles/Roles.jsx, which is usually just
// <GeneratedModulePage moduleName="Roles" {...props} />.
//
// Everything shared lives in GeneratedModulePage. Only what is specific
// to Roles goes here, passed in as props -- so the shared runtime never
// has to learn that this module exists.
export default function RolesPage() {
  return (
    <GeneratedModulePage
      modulePath="roles"
      renderCell={(row, column, defaultCell) => {
        if (column.key === "is_superadmin") {
          return row.is_superadmin ? <span className="badge">Superadmin</span> : "—";
        }
        if (column.key === "theme_color" && row.theme_color) {
          return (
            <span className="swatch-cell">
              <span className="swatch" style={{ background: row.theme_color }} />
              {row.theme_color}
            </span>
          );
        }
        return defaultCell(row, column);
      }}
    />
  );
}

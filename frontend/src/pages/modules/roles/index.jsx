import { getThemeHex, resolveThemeColor } from "../../../config/themeOptions";
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
          return row.is_superadmin ? <span className="inline-block rounded-full bg-skin-custom px-2 py-0.5 text-[11px] font-semibold text-theme-contrast">Superadmin</span> : "Normal";
        }
        if (column.key === "theme_color" && row.theme_color) {
          return (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block size-3 rounded-[3px] border border-skin-border" style={{ background: getThemeHex(resolveThemeColor(row.theme_color)) }} />
              {row.theme_color}
            </span>
          );
        }
        return defaultCell(row, column);
      }}
    />
  );
}

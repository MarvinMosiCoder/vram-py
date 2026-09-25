"use client";

import { getThemeHex, resolveThemeColor } from "@/config/themeOptions";
import GeneratedModulePage from "@/components/modules/GeneratedModulePage";

export default function RolesPage() {
  return (
    <GeneratedModulePage
      modulePath="roles"
      renderCell={(row, column, defaultCell) => {
        if (column.key === "is_superadmin") {
          return row.is_superadmin ? <span className="inline-block rounded-full bg-skin-custom px-2 py-0.5 text-[11px] font-semibold text-theme-contrast">Superadmin</span> : "Normal";
        }
        if (column.key === "theme_color" && typeof row.theme_color === "string" && row.theme_color) {
            const themeColor = row.theme_color;   // now typed as string
            return (
                <span className="inline-flex items-center gap-2">
                <span className="inline-block size-3 rounded-[3px] border border-skin-border" style={{ background: getThemeHex(resolveThemeColor(themeColor)) }} />
                    {themeColor}
                </span>
            );
        }
        return defaultCell(row, column);
      }}
    />
  );
}

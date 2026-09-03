import { NavLink } from "react-router-dom";

export default function SidebarMenuCard({ to, menuTitle, icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex items-center overflow-hidden rounded-lg border px-2.5 py-2 text-[12px] font-semibold transition select-none ${
          isActive
            ? "border-transparent bg-skin-accent-soft text-skin-accent"
            : "border-transparent text-skin-dim hover:bg-skin-panel hover:text-skin-text"
        }`
      }
    >
      <span className="mr-2.5 flex h-7 w-7 items-center justify-center rounded-md bg-skin-border/40 text-[12px] transition group-hover:bg-skin-accent-soft">
        {icon ? <i className={icon} /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{menuTitle}</span>
    </NavLink>
  );
}

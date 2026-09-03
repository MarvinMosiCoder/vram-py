import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

export default function SidebarMenuCardMultiple({ menuTitle, icon, childMenus }) {
  const { pathname } = useLocation();
  const hasActiveChild = (childMenus || []).some(
    (child) => pathname === `/${child.path || child.slug}`
  );
  const [isOpen, setIsOpen] = useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) setIsOpen(true);
  }, [hasActiveChild]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex w-full items-center overflow-hidden rounded-lg border px-2.5 py-2 text-[12px] font-semibold transition select-none ${
          hasActiveChild
            ? "border-transparent bg-skin-accent-soft text-skin-accent"
            : "border-transparent text-skin-dim hover:bg-skin-panel hover:text-skin-text"
        }`}
      >
        <span className="mr-2.5 flex h-7 w-7 items-center justify-center rounded-md bg-skin-border/40 text-[12px] transition group-hover:bg-skin-accent-soft">
          {icon ? <i className={icon} /> : null}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{menuTitle}</span>
        <i
          className={`fa-solid fa-caret-down text-[10px] transition-transform duration-200 ${
            isOpen ? "-rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`ml-7 mt-1 flex flex-col gap-1 overflow-hidden border-l border-skin-border pl-3 transition-all duration-200 ${
          isOpen ? "max-h-[100rem] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {(childMenus || []).map((child) => (
          <NavLink
            key={child.id}
            to={`/${child.path || child.slug}`}
            className={({ isActive }) =>
              `flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                isActive
                  ? "border-transparent bg-skin-accent-soft text-skin-accent"
                  : "border-transparent text-skin-dim hover:bg-skin-panel hover:text-skin-text"
              }`
            }
          >
            <span className="mr-2 flex h-4 w-4 items-center justify-center">
              {child.icon ? <i className={`${child.icon} text-[9px]`} /> : null}
            </span>
            <span className="min-w-0 flex-1 truncate">{child.name}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

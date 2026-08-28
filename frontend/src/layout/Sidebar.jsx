import { NavLink } from "react-router-dom";

// Add more entries here as new pages get built. `to` must match a real
// route in App.jsx or the link will just fall through to the catch-all.
const links = [{ to: "/dashboard", label: "Dashboard" }];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Vram Admin</div>
      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

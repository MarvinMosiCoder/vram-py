import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import api from "../api";

export default function AppSidebar() {
  const [menus, setMenus] = useState([]);

  useEffect(() => {
    api.get("/admin_sidebar").then((res) => setMenus(res.data)).catch(() => {});
  }, []);

  const adminMenus = menus;
  const userMenus = [];
  console.log("adminMenus", adminMenus);
  const renderLinks = (items) =>
    items.map((m) => (
      <NavLink
        key={m.id}
        to={`/${m.slug}`}
        className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
      >
        {m.name}
      </NavLink>
    ));

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Vram Admin</div>
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className="sidebar-link">Dashboard</NavLink>
        {renderLinks(userMenus)}
        {adminMenus.length > 0 && (
          <>
            <div className="sidebar-section-label">Admin</div>
            {renderLinks(adminMenus)}
          </>
        )}
      </nav>
    </aside>
  );
}
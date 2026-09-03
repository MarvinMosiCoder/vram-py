import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";

export default function AppNavbar() {
  const { user, logout } = useAuth();
  const { toggleSidebar } = useSidebar();

  return (
    <div className="top-bar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          aria-label="Toggle sidebar"
          onClick={() => toggleSidebar()}
          className="hidden h-8 w-8 items-center justify-center rounded-md text-skin-dim hover:bg-skin-panel hover:text-skin-text max-md:inline-flex"
        >
          <i className="fa-solid fa-bars" />
        </button>
        <span style={{ fontSize: 14, color: "var(--text-dim)" }}>{user?.email}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="role-badge">{user?.role}</span>
        <button className="signout" onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}

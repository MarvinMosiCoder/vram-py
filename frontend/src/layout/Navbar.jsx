import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <div className="top-bar">
      <span style={{ fontSize: 14, color: "var(--text-dim)" }}>{user?.email}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="role-badge">{user?.role}</span>
        <button className="signout" onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";
import Avatar from "../components/avatar/Avatar";
import Modal from "../components/modal/Modal";
import SecondaryButton from "../components/button/SecondaryButton";
import DangerButton from "../components/button/DangerButton";

const AppNavbar = () => {
  const { user, logout } = useAuth();
  const { toggleSidebar } = useSidebar();

  const [showMenu, setShowMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [now, setNow] = useState(new Date());
  const menuRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = user?.name || user?.email || "";

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
  };

  return (
    <>
      <div className="top-bar">
        <div className="top-bar-left">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => toggleSidebar()}
            aria-label="Toggle sidebar"
          >
            <i className="fa fa-bars" aria-hidden="true" />
          </button>
          <Link to="/dashboard" className="top-bar-brand">
            Vram Admin
          </Link>
        </div>

        <div className="top-bar-right">
          <div className="top-bar-clock">
            <i className="fa fa-calendar-days" aria-hidden="true" />
            <span>
              {now.toLocaleString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="top-bar-user" ref={menuRef}>
            <button
              type="button"
              className="top-bar-user-trigger"
              onClick={() => setShowMenu((v) => !v)}
              aria-haspopup="true"
              aria-expanded={showMenu}
            >
              <Avatar name={displayName} />
              <span className="top-bar-user-name">{displayName}</span>
              <i
                className={`fa fa-chevron-down top-bar-user-caret ${showMenu ? "is-open" : ""}`.trim()}
                aria-hidden="true"
              />
            </button>

            {showMenu && (
              <div className="top-bar-menu" role="menu">
                <div className="top-bar-menu-head">
                  <Avatar name={displayName} size="lg" />
                  <div className="top-bar-menu-identity">
                    <p className="top-bar-menu-name">{displayName || "—"}</p>
                    <p className="top-bar-menu-email">{user?.email}</p>
                    {user?.role && <span className="role-badge">{user.role}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  className="top-bar-menu-item is-danger"
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                >
                  <i className="fa fa-power-off" aria-hidden="true" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        show={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="Logout"
        icon="fa fa-power-off"
      >
        <p className="modal-text">Do you want to logout?</p>
        <div className="modal-actions">
          <SecondaryButton onClick={() => setShowLogoutConfirm(false)}>Cancel</SecondaryButton>
          <DangerButton onClick={confirmLogout}>Logout</DangerButton>
        </div>
      </Modal>
    </>
  );
};

export default AppNavbar;

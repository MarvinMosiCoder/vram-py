import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";
import Avatar from "../components/avatar/Avatar";
import Modal from "../components/modal/Modal";
import SecondaryButton from "../components/button/SecondaryButton";
import DangerButton from "../components/button/DangerButton";
import ApplicationLogo from "../components/system/ApplicationLogo";
import ApplicationName from "../components/system/ApplicationName";

const AppNavbar = () => {
  const { user, logout } = useAuth();
  const { toggleSidebar } = useSidebar();
  const [showMenu, setShowMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [now, setNow] = useState(new Date());
  const menuRef = useRef(null);
  const [appLogo, setAppLogo] = useState('');
  const [appName, setAppName] = useState('');

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchAppLogo = async () => {
      const logo = await ApplicationLogo();
      setAppLogo(logo);
    };
    fetchAppLogo();
    const fetchAppName = async () => {
      const name = await ApplicationName();
      setAppName(name);
    };
    fetchAppName();
  }, [ApplicationName, ApplicationLogo]);

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
      <div className="flex shrink-0 items-center justify-between border-b border-skin-border bg-skin-panel px-4 md:px-7">
        <div className="flex min-w-0 items-center gap-3.5">
          <button
            type="button"
            className="mt-0! hidden h-9! w-9! items-center justify-center rounded-lg border border-skin-border bg-transparent! p-0! text-skin-dim transition hover:bg-skin-border! hover:text-skin-text max-[767px]:inline-flex"
            onClick={() => toggleSidebar()}
            aria-label="Toggle sidebar"
          >
            <i className="fa fa-bars" aria-hidden="true" />
          </button>
          <Link
            to="/dashboard"
            className="whitespace-nowrap font-mono text-[13px] uppercase tracking-[0.06em] text-skin-text no-underline hover:text-skin-accent"
          >
            <div className="flex gap-x-4 items-center justify-center lg:justify-start px-5 py-2.5 lg:py-3.75">
              {
                  appLogo ? (
                      <img
                          src={appLogo}
                          className="w-7 h- cursor-pointer duration-500"
                          alt="App Logo"
                      />
                  ): (
                      <div className="flex justify-center items-center h-full">
                          <div className="h-7 w-7 rounded-3xl bg-gray-100 animate-pulse" />
                      </div>
                  )
              }
            
                  <p className="font-semibold text-[15px]">{appName || "Vram Py"}</p>
             
          </div>
          </Link>
        </div>

        <div className="flex min-w-0 items-center gap-3.5">
          <div className="hidden items-center gap-2 whitespace-nowrap text-[13px] text-skin-dim lg:flex">
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

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="mt-0! flex h-9! w-auto items-center gap-2.5 border-0 bg-transparent! p-0! text-skin-text!"
              onClick={() => setShowMenu((v) => !v)}
              aria-haspopup="true"
              aria-expanded={showMenu}
            >
              <Avatar name={displayName} />
              <span className="hidden max-w-35 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium md:inline-block">
                {displayName}
              </span>
              <i
                className={`fa fa-chevron-down text-[11px] text-skin-dim transition-transform duration-150 ${showMenu ? "rotate-180" : ""}`.trim()}
                aria-hidden="true"
              />
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-[calc(100%+10px)] z-150 flex w-65 flex-col gap-0 rounded-[10px] border border-skin-border bg-skin-panel py-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
                role="menu"
              >
                <div className="mb-1 flex items-center gap-2.5 border-b border-skin-border px-4 pb-3">
                  <Avatar name={displayName} size="lg" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold">
                      {displayName || "-"}
                    </p>
                    <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-skin-dim">
                      {user?.email}
                    </p>
                    {user?.role && (
                      <span className="w-fit rounded-full border border-skin-accent-dim bg-skin-accent-soft px-2.25 py-0.75 font-mono text-[11px] uppercase tracking-[0.06em] text-skin-accent">
                        {user.role}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-0! flex h-auto! w-full! items-center gap-2.5 border-0 bg-transparent! px-4 py-2.5 text-left text-[13px] text-skin-danger! hover:bg-skin-danger-soft!"
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
        <p className="m-0 text-[13px] text-skin-dim">Do you want to logout?</p>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={() => setShowLogoutConfirm(false)}>Cancel</SecondaryButton>
          <DangerButton onClick={confirmLogout}>Logout</DangerButton>
        </div>
      </Modal>
    </>
  );
};

export default AppNavbar;

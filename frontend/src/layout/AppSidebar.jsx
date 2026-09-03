import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";
import UserSidebar from "../components/sidebar/UserSidebar";
import AdminSidebar from "../components/sidebar/AdminSidebar";

export default function AppSidebar() {
  const { user } = useAuth();
  const { isSidebarOpen, toggleSidebar } = useSidebar();

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleMediaQueryChange = (e) => toggleSidebar(!e.matches);
    handleMediaQueryChange(mediaQuery);
    mediaQuery.addEventListener("change", handleMediaQueryChange);
    return () => mediaQuery.removeEventListener("change", handleMediaQueryChange);
  }, []);

  return (
    <>
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-60 bg-black/40 md:hidden"
          onClick={() => toggleSidebar(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-70 shrink-0 overflow-hidden border-r border-skin-border bg-skin-panel shadow-xl transition-transform duration-300 md:static md:shadow-none md:transition-[width] md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0 md:w-70" : "-translate-x-full md:w-0"
        }`}
      >
        <div className="flex h-full w-70 flex-col overflow-y-auto px-3 pb-8 pt-5">
          <div className="mb-5 px-2.5 font-mono text-[13px] uppercase tracking-[0.08em] text-skin-accent">
            Vram Admin
          </div>
          <UserSidebar />
          {user?.is_superadmin && <AdminSidebar />}
        </div>
      </aside>
    </>
  );
}

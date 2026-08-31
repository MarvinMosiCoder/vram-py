import AppNavbar from "./AppNavbar";
import AppSidebar from "./AppSidebar";
import AppContent from "./AppContent";
import AppFooter from "./AppFooter";
import { NavbarProvider } from "../context/NavbarContext";

// Ported from the Laravel project's Layouts/layout/layout.jsx -- same regions,
// same nesting:
//
//   AppNavbar                      full width, fixed, 64px tall
//   AppSidebar                     below it, on the left
//   main
//     AppContent                   the only scrolling region
//     AppFooter                    pinned under it
//
// NavbarProvider is mounted HERE rather than in App.jsx, matching the original:
// the title belongs to the authenticated shell, so the login page never gets a
// provider it has no use for.
const Layout = ({ children }) => {
  return (
    <NavbarProvider>
      <div className="app-shell">
        <AppNavbar />
        <div className="app-body">
          <AppSidebar />
          <main className="app-main">
            <AppContent>{children}</AppContent>
            <AppFooter />
          </main>
        </div>
      </div>
    </NavbarProvider>
  );
};

export default Layout;

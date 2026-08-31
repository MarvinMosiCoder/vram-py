import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import BreadCrumbs from "../components/table/BreadCrumbs";
import { useNavbarContext } from "../context/NavbarContext";
import { ToastProvider } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";

// The scrolling content region of the app shell: breadcrumbs, then the page.
//
// Ported from the Inertia original, which needed four things this project does
// not have:
//
//   usePage().props.auth        -> no shared props; the user comes from
//                                  useAuth(), and nothing here needs it
//   auth.module[0].name         -> no module list in the response, so the
//                                  default title is derived from the route
//   Components/Table/BreadCrumbs -> written for this project, URL-driven
//   Context/ToastContext        -> written for this project
//
// It also imported from ../../Context/..., which pointed outside src/. The
// paths below are the real ones.

const prettify = (segment) =>
    segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const AppContent = ({ children }) => {
    const { theme } = useTheme();
    const { title, setTitle } = useNavbarContext() ?? {};
    const { pathname } = useLocation();

    // The original fired setTitle inside a setTimeout(…, 5) because Inertia's
    // shared props arrived a tick late. Here the route is available
    // synchronously, so the default title is just derived from it -- and a page
    // is still free to call setTitle() afterwards to override.
    useEffect(() => {
        const last = pathname.split("/").filter(Boolean).pop();
        setTitle?.(last ? prettify(last) : "Dashboard");
    }, [pathname, setTitle]);

    const isDark = theme === "bg-skin-black";

    return (
        <div id="app-content" className={`app-content ${isDark ? "is-dark" : ""}`.trim()}>
            <div className="app-content-inner">
                <BreadCrumbs title={title} />
                <div id="content-area" className="content-area">
                    <ToastProvider>{children}</ToastProvider>
                </div>
            </div>
        </div>
    );
};

export default AppContent;

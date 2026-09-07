import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import BreadCrumbs from "../components/table/BreadCrumbs";
import { useNavbarContext } from "../context/NavbarContext";
import { ToastProvider } from "../context/ToastContext";

const prettify = (segment) =>
    segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const AppContent = ({ children }) => {
    const { title, setTitle } = useNavbarContext() ?? {};
    const { pathname } = useLocation();

    useEffect(() => {
        const [root] = pathname.split("/").filter(Boolean);
        setTitle?.(root ? prettify(root) : "Dashboard");
    }, [pathname, setTitle]);


    return (
        <div id="app-content" className="min-h-0 flex-auto overflow-y-auto bg-skin-bg p-4 md:px-6 md:py-5">
            <div className="mx-auto flex w-full max-w-400 flex-col gap-4">
                <BreadCrumbs title={title} />
                <div id="content-area" className="relative min-h-90 pb-4">
                    <ToastProvider>{children}</ToastProvider>
                </div>
            </div>
        </div>
    );
};

export default AppContent;

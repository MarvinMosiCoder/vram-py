import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

// Ported from the Laravel project's Layouts/layout/AppFooter.jsx.
//
// Its Tailwind classes are kept as layout/structure; the colours come from the
// project's own tokens instead of gray-200/white, because this app's surfaces
// are dark by default rather than light.
const AppFooter = () => {
    const { theme } = useTheme();
    const [currentYear] = useState(new Date().getFullYear());
    const [showWaterMark, setShowWaterMark] = useState(false);

    return (
        <div className={`layout-footer ${theme === "bg-skin-black" ? "is-dark" : ""}`.trim()}>
            <div className="layout-footer-copy">
                Copyright &copy; {currentYear}. All Rights Reserved
            </div>
            <div className="layout-footer-brand">Powered by VRAM</div>
            <button
                type="button"
                className="layout-footer-toggle"
                onClick={() => setShowWaterMark((value) => !value)}
                aria-label="Show watermark"
            >
                <i className="fa fa-info-circle" aria-hidden="true"></i>
            </button>
            {showWaterMark && (
                <div className="layout-footer-watermark">Powered by VRAM</div>
            )}
        </div>
    );
};

export default AppFooter;

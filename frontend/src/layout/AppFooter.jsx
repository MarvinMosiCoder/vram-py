import { useState } from "react";

// Ported from the Laravel project's Layouts/layout/AppFooter.jsx.
//
// Tailwind utilities consume the active theme's surface and text tokens.
const AppFooter = () => {
    const [currentYear] = useState(new Date().getFullYear());
    const [showWaterMark, setShowWaterMark] = useState(false);

    return (
        <div className="relative mt-auto flex min-h-12 w-full shrink-0 items-center justify-between gap-3 border-t border-skin-border bg-skin-panel px-4 text-[13px] text-skin-dim select-none md:px-6">
            <div>
                Copyright &copy; {currentYear}. All Rights Reserved
            </div>
            <div className="hidden text-xs md:block">Powered by VRAM</div>
            <button
                type="button"
                className="m-0 w-auto cursor-pointer border-0 bg-transparent px-1 py-0 text-[15px] font-semibold text-inherit hover:text-skin-text md:hidden"
                onClick={() => setShowWaterMark((value) => !value)}
                aria-label="Show watermark"
            >
                <i className="fa fa-info-circle" aria-hidden="true"></i>
            </button>
            {showWaterMark && (
                <div className="absolute right-3.75 bottom-10 rounded-md bg-skin-custom px-2 py-1 text-xs text-theme-contrast md:hidden">Powered by VRAM</div>
            )}
        </div>
    );
};

export default AppFooter;

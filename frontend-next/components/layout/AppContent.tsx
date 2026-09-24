"use client";

import type { ReactNode } from "react";

import BreadCrumbs from "@/components/table/BreadCrumbs";
import { useNavbarContext } from "@/context/NavbarContext";

const AppContent = ({ children }: { children: ReactNode }) => {
    const { title } = useNavbarContext();

    return (
        <div id="app-content" className="min-h-0 flex-auto overflow-y-auto bg-skin-bg p-4 md:px-6 md:py-5">
            <div className="mx-auto flex w-full max-w-400 flex-col gap-4">
                <BreadCrumbs title={title} />
                <div id="content-area" className="relative min-h-90 pb-4">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default AppContent;

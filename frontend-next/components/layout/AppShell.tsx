"use client";

import type { ReactNode } from "react";

import AppNavbar from "@/components/layout/AppNavbar";
import AppSidebar from "@/components/layout/AppSidebar";
import AppContent from "@/components/layout/AppContent";
import AppFooter from "@/components/layout/AppFooter";
import { NavbarProvider } from "@/context/NavbarContext";

// Shared authenticated shell; page content is the only scrolling region.
const AppShell = ({ children }: { children: ReactNode }) => {
  return (
    <NavbarProvider>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
        <AppNavbar />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <AppContent>{children}</AppContent>
            <AppFooter />
          </main>
        </div>
      </div>
    </NavbarProvider>
  );
};

export default AppShell;

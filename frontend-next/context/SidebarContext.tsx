"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const SidebarContext = createContext<{
  isSidebarOpen: boolean;
  toggleSidebar: (nextState?: boolean) => void;
  closeSidebar: () => void;
  openSidebar: () => void;
} | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const toggleSidebar = useCallback((nextState?: boolean) => {
    setIsSidebarOpen((previous) => typeof nextState === "boolean" ? nextState : !previous);
  }, []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar, closeSidebar, openSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used inside SidebarProvider");
  return context;
}

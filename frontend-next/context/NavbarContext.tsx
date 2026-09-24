"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const NavbarContext = createContext<{ title: string } | null>(null);

export function NavbarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [root] = pathname.split("/").filter(Boolean);
  const title = root
    ? root.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Dashboard";
  return <NavbarContext.Provider value={{ title }}>{children}</NavbarContext.Provider>;
}

export function useNavbarContext() {
  const context = useContext(NavbarContext);
  if (!context) throw new Error("useNavbarContext must be used inside NavbarProvider");
  return context;
}

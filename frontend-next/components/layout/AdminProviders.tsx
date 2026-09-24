"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/context/authContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SidebarProvider } from "@/context/SidebarContext";

export default function AdminProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <ThemeProvider key={user.id} themeColor={user.theme_color} profileData={user}>
      <SidebarProvider>{children}</SidebarProvider>
    </ThemeProvider>
  );
}

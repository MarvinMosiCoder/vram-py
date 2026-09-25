import type { ReactNode } from "react";
import RequireAuth from "@/components/auth/RequiredAuth";
import AdminProviders from "@/components/layout/AdminProviders";
import AppShell from "@/components/layout/AppShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AdminProviders>
        <AppShell>{children}</AppShell>
      </AdminProviders>
    </RequireAuth>
  );
}

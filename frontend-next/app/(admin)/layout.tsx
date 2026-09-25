import type { ReactNode } from "react";
import RequireAuth from "@/components/auth/RequiredAuth";
import AnnouncementGate from "@/components/auth/AnnouncementGate";
import ForcePasswordGate from "@/components/auth/ForcePasswordGate";
import AdminProviders from "@/components/layout/AdminProviders";
import AppShell from "@/components/layout/AppShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AdminProviders>
        {/* Inside the providers so theme tokens apply. The forced-change gate
            outranks announcements: AnnouncementGate renders nothing while
            must_change is set, so the two modals never stack. */}
        <ForcePasswordGate />
        <AnnouncementGate />
        <AppShell>{children}</AppShell>
      </AdminProviders>
    </RequireAuth>
  );
}

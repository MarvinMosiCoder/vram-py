"use client";

import type { SidebarMenu } from "@/types/admin";

import { useEffect, useState } from "react";
import api from "@/lib/http";
import SidebarMenuCard from "@/components/sidebar/SidebarMenuCard";

export default function AdminSidebar() {
  const [modules, setModules] = useState<SidebarMenu[]>([]);

  useEffect(() => {
    api.get<SidebarMenu[]>("/admin_sidebar").then((res) => setModules(res.data)).catch(() => {});
  }, []);

  if (modules.length === 0) return null;

  return (
    <div className="mt-7">
      <p className="mb-2.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.16em]">
        Admin Menu
      </p>
      <div className="space-y-1.5">
        {modules.map((mod) => (
          <SidebarMenuCard key={mod.id} to={`/${mod.path}`} menuTitle={mod.name} icon={mod.icon} />
        ))}
      </div>
    </div>
  );
}

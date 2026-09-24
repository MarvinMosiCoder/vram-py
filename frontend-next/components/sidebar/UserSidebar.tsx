"use client";

import type { SidebarMenu } from "@/types/admin";

import { useEffect, useState } from "react";
import api from "@/lib/http";
import SidebarMenuCard from "@/components/sidebar/SidebarMenuCard";
import SidebarMenuCardMultiple from "@/components/sidebar/SidebarMenuCardMultiple";

export default function UserSidebar() {
  const [menus, setMenus] = useState<SidebarMenu[]>([]);

  useEffect(() => {
    api.get<SidebarMenu[]>("/user_sidebar").then((res) => setMenus(res.data)).catch(() => {});
  }, []);

  return (
    <div>
      <p className="mb-2.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.16em]">
        Menu
      </p>
      <div className="space-y-1.5">
        <SidebarMenuCard to="/dashboard" menuTitle="Dashboard" icon="fa-solid fa-gauge" />
        {menus.map((menu) =>
          menu.type === "Route" || !menu.children?.length ? (
            <SidebarMenuCard
              key={menu.id}
              to={`/${menu.path || menu.slug}`}
              menuTitle={menu.name}
              icon={menu.icon}
            />
          ) : (
            <SidebarMenuCardMultiple
              key={menu.id}
              menuTitle={menu.name}
              icon={menu.icon}
              childMenus={menu.children}
            />
          )
        )}
      </div>
    </div>
  );
}

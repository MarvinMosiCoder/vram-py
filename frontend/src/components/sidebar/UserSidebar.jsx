import { useEffect, useState } from "react";
import api from "../../api";
import SidebarMenuCard from "./SidebarMenuCard";
import SidebarMenuCardMultiple from "./SidebarMenuCardMultiple";

export default function UserSidebar() {
  const [menus, setMenus] = useState([]);

  useEffect(() => {
    api.get("/user_sidebar").then((res) => setMenus(res.data)).catch(() => {});
  }, []);

  return (
    <div>
      <p className="mb-2.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-skin-dim">
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

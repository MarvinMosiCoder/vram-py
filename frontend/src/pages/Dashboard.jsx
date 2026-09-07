import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api";

export default function Dashboard() {
  const { user } = useAuth();
  const [userCount, setUserCount] = useState(null);
  console.log("user", user);
  useEffect(() => {
    // Only admins can call /admin/users — for anyone else this 403s,
    // which we just quietly ignore so the card shows as locked.
    if (user?.role_id == 1) {
      api
        .get("/admin/users")
        .then((res) => setUserCount(res.data.length))
        .catch(() => {});
    }
  }, [user]);

  const canEdit = user?.role_id == 1 || user?.role_id == 2;
  const isAdmin = user?.role_id == 1;

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 p-7">
        <div className="rounded-[10px] border border-skin-border bg-skin-panel p-5 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-skin-dim">
          <h3>Your role</h3>
          <div className="font-mono text-2xl">{user?.role_id}</div>
        </div>

        <div className={`rounded-[10px] border border-skin-border bg-skin-panel p-5 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-skin-dim ${canEdit ? "" : "opacity-40"}`}>
          <h3>Content area</h3>
          <div className="font-mono text-2xl">{canEdit ? "Open" : "Restricted"}</div>
        </div>

        <div className={`rounded-[10px] border border-skin-border bg-skin-panel p-5 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-skin-dim ${isAdmin ? "" : "opacity-40"}`}>
          <h3>Total users</h3>
          <div className="font-mono text-2xl">{isAdmin ? (userCount ?? "…") : "Admin only"}</div>
        </div>
      </div>
    </div>
  );
}

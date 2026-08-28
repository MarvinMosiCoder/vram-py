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
      <div className="grid">
        <div className="card">
          <h3>Your role</h3>
          <div className="value">{user?.role_id}</div>
        </div>

        <div className={`card ${canEdit ? "" : "locked"}`}>
          <h3>Content area</h3>
          <div className="value">{canEdit ? "Open" : "Restricted"}</div>
        </div>

        <div className={`card ${isAdmin ? "" : "locked"}`}>
          <h3>Total users</h3>
          <div className="value">{isAdmin ? (userCount ?? "…") : "Admin only"}</div>
        </div>
      </div>
    </div>
  );
}

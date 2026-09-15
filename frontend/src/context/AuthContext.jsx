import { createContext, useContext, useState, useEffect } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [announcementQueue, setAnnouncementQueue] = useState([]);
  const [passwordPolicy, setPasswordPolicy] = useState(null);

  async function loadAnnouncements() {
    try {
      const { data } = await api.get("/announcements/unread");
      const nextQueue = Array.isArray(data) ? data : [];
      setAnnouncementQueue(nextQueue);
      return nextQueue;
    } catch (error) {
      console.error("Failed to load announcements", error);
      setAnnouncementQueue([]);
      return [];
    }
  }

  async function loadPasswordPolicy() {
    try {
      const { data } = await api.get("/password-policy");
      setPasswordPolicy(data);
      return data;
    } catch (error) {
      // Fail open. The forced-change modal is a prompt, not a security
      // boundary, so a failed policy read must not lock an admin out.
      console.error("Failed to load password policy", error);
      setPasswordPolicy(null);
      return null;
    }
  }

  // On first load, if a token is already saved (from a previous
  // session), try to fetch who it belongs to.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/me")
      .then(async (res) => {
        setUser(res.data);
        await loadPasswordPolicy();
        await loadAnnouncements();
      })
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);

    const res = await api.post("/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    localStorage.setItem("token", res.data.access_token);

    const me = await api.get("/me");
    setUser(me.data);
    await loadPasswordPolicy();
    await loadAnnouncements();
  }

  async function refreshUser() {
    const res = await api.get("/me");
    setUser(res.data);
    return res.data;
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
    setAnnouncementQueue([]);
    setPasswordPolicy(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
        announcementQueue,
        setAnnouncementQueue,
        loadAnnouncements,
        passwordPolicy,
        setPasswordPolicy,
        loadPasswordPolicy,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — lets any component do `const { user } = useAuth()`
// instead of importing AuthContext + useContext every time.
export function useAuth() {
  return useContext(AuthContext);
}

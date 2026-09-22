"use client";

import {
  createContext, useContext, useState, useEffect, useRef, useCallback,
  type ReactNode, type Dispatch, type SetStateAction,
} from "react";
import {
  login as requestLogin, getCurrentUser, getAnnouncements, getPasswordPolicy,
  type CurrentUser, type Announcement, type PasswordPolicy,
} from "@/lib/api";

type AuthContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<CurrentUser>;
  announcementQueue: Announcement[];
  setAnnouncementQueue: Dispatch<SetStateAction<Announcement[]>>;
  loadAnnouncements: () => Promise<Announcement[]>;
  passwordPolicy: PasswordPolicy | null;
  setPasswordPolicy: Dispatch<SetStateAction<PasswordPolicy | null>>;
  loadPasswordPolicy: () => Promise<PasswordPolicy | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [announcementQueue, setAnnouncementQueue] = useState<Announcement[]>([]);
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy | null>(null);
  // Ignore requests that finish after logout, another login, or unmount.
  const session = useRef(0);

  const loadAnnouncements = useCallback(async () => {
    const version = session.current;
    const token = localStorage.getItem("token");
    let announcements: Announcement[] = [];
    try {
      if (token) announcements = await getAnnouncements(token);
    } catch (error) {
      console.error("Failed to load announcements", error);
    }
    if (version === session.current) setAnnouncementQueue(announcements);
    return announcements;
  }, []);

  const loadPasswordPolicy = useCallback(async () => {
    const version = session.current;
    const token = localStorage.getItem("token");
    let policy: PasswordPolicy | null = null;
    try {
      if (token) policy = await getPasswordPolicy(token);
    } catch (error) {
      // Match the React app: an optional policy request must not block login.
      console.error("Failed to load password policy", error);
    }
    if (version === session.current) setPasswordPolicy(policy);
    return policy;
  }, []);

  useEffect(() => {
    const version = ++session.current;
    async function restoreSession() {
      // Restore only after mounting; localStorage does not exist on the server.
      await Promise.resolve();
      if (version !== session.current) return;
      const token = localStorage.getItem("token");
      try {
        if (token) {
          const currentUser = await getCurrentUser(token);
          if (version !== session.current) return;
          setUser(currentUser);
          await Promise.all([loadPasswordPolicy(), loadAnnouncements()]);
        }
      } catch {
        if (version === session.current) {
          localStorage.removeItem("token");
          setUser(null);
        }
      } finally {
        if (version === session.current) setLoading(false);
      }
    }
    void restoreSession();
    return () => { session.current += 1; };
  }, [loadAnnouncements, loadPasswordPolicy]);

  async function login(email: string, password: string) {
    const version = ++session.current;
    setLoading(true);
    setUser(null);
    setAnnouncementQueue([]);
    setPasswordPolicy(null);
    try {
      const result = await requestLogin(email, password);
      if (version !== session.current) return;
      localStorage.setItem("token", result.access_token);
      const currentUser = await getCurrentUser(result.access_token);
      if (version !== session.current) return;
      setUser(currentUser);
      await Promise.all([loadPasswordPolicy(), loadAnnouncements()]);
    } catch (error) {
      if (version === session.current) localStorage.removeItem("token");
      throw error;
    } finally {
      if (version === session.current) setLoading(false);
    }
  }

  async function refreshUser() {
    const version = session.current;
    const token = localStorage.getItem("token");
    if (!token) throw new Error("You are not signed in.");
    const currentUser = await getCurrentUser(token);
    if (version === session.current) setUser(currentUser);
    return currentUser;
  }

  // Match the original React context's local sign-out behavior.
  function logout() {
    session.current += 1;
    localStorage.removeItem("token");
    setUser(null);
    setAnnouncementQueue([]);
    setPasswordPolicy(null);
    setLoading(false);
  }

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, refreshUser,
      announcementQueue, setAnnouncementQueue, loadAnnouncements,
      passwordPolicy, setPasswordPolicy, loadPasswordPolicy,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

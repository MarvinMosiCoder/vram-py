"use client";

import {
  createContext, useContext, useEffect, useState,
  type Dispatch, type ReactNode, type SetStateAction,
} from "react";
import type { CurrentUser } from "@/lib/api";
import {
  applyThemeColor, getThemeClass, isCustomThemeColor, resolveThemeColor,
} from "@/config/themeOptions";

const ThemeContext = createContext<{ theme: string } | null>(null);
const ProfileContext = createContext<{
  profile: string | null;
  setProfile: Dispatch<SetStateAction<string | null | undefined>>;
} | null>(null);

export function ThemeProvider({ children, themeColor, profileData }: {
  children: ReactNode;
  themeColor?: string | null;
  profileData: CurrentUser;
}) {
  const theme = getThemeClass(themeColor);
  // An explicit null clears the avatar; undefined follows refreshed /me data.
  const [profileOverride, setProfile] = useState<string | null>();
  const profile = profileOverride === undefined
    ? profileData.profile ?? null : profileOverride;

  useEffect(() => {
    const resolved = resolveThemeColor(themeColor);
    const root = document.documentElement;
    applyThemeColor(resolved);
    root.classList.toggle("app-theme-dark", resolved === "skin-black");
    root.dataset.appTheme = isCustomThemeColor(themeColor) ? "custom" : resolved;
    return () => {
      root.classList.remove("app-theme-dark");
      delete root.dataset.appTheme;
      applyThemeColor("system");
    };
  }, [themeColor]);

  return (
    <ThemeContext.Provider value={{ theme }}>
      <ProfileContext.Provider value={{ profile, setProfile }}>
        {children}
      </ProfileContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used inside ThemeProvider");
  return context;
}

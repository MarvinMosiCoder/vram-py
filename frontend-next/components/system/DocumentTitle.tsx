"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import getAppName from "@/lib/ApplicationName";

function formatTitle(pathname: string) {
  const segment = pathname.split("/").filter(Boolean).pop();
  if (!segment) return "Dashboard";
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Sets "<app name> | <last path segment>", like the legacy DocumentTitle.
export default function DocumentTitle() {
  const pathname = usePathname();
  const [appName, setAppName] = useState("");

  useEffect(() => {
    let active = true;
    void getAppName().then((name) => {
      if (active) setAppName(name);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (appName) document.title = `${appName} | ${formatTitle(pathname)}`;
  }, [pathname, appName]);

  return null;
}

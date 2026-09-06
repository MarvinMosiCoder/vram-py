import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const APP_NAME = "Vram Admin";

function formatTitle(pathname) {
  const segment = pathname.split("/").filter(Boolean).pop();

  if (!segment) {
    return "Dashboard";
  }

  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = `${APP_NAME} | ${formatTitle(pathname)}`;
  }, [pathname]);

  return null;
}
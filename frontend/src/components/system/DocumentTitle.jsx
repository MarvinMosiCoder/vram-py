import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import ApplicationName from "./ApplicationName";

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
  const [appName, setAppName] = useState('');

  useEffect(() => {
    const fetchAppName = async () => {
      const name = await ApplicationName();
      setAppName(name);
    };
    fetchAppName();
  }, [ApplicationName]);

  useEffect(() => {
    document.title = `${appName} | ${formatTitle(pathname)}`;
  }, [pathname, appName]);

  return null;
}
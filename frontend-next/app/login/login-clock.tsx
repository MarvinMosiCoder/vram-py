"use client";

import { useEffect, useState } from "react";

export default function LoginClock() {
  // A shared initial placeholder keeps server and browser rendering identical.
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const date = currentTime?.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const time = currentTime?.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <p className="mb-5 inline-flex rounded-full border border-skin-border bg-skin-bg px-3.5 py-1.75 font-mono text-xs text-skin-dim">
      {currentTime ? `${date} — ${time}` : "Loading local time…"}
    </p>
  );
}

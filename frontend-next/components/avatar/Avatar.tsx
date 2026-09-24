"use client";

import Image from "next/image";

import { useState } from "react";
import colorMap from "@/components/avatar/colorMap";

const getInitials = (value?: string | null) => {
  const parts = (value || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Profile images use the Python backend's stored filename; initials are the fallback.
const Avatar = ({ name, size = "md", fileName }: { name?: string | null; size?: "md" | "lg"; fileName?: string | null }) => {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = fileName ? `/images/profile/${encodeURIComponent(fileName)}` : null;
  const initials = getInitials(name);
  const bgClass = colorMap[initials.charAt(0)] || "bg-slate-300";

  return (
    <div
      className={`flex overflow-hidden shrink-0 items-center justify-center rounded-full border border-skin-border font-semibold text-gray-800 ${
        size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-[13px]"
      } ${bgClass}`}
    >
      {source && failedSource !== source ? (
        <Image
          src={source}
          width={size === "lg" ? 48 : 36}
          height={size === "lg" ? 48 : 36}
          unoptimized
          alt={`${name || "User"} profile`}
          className="h-full w-full object-cover"
          onError={() => setFailedSource(source)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

export default Avatar;

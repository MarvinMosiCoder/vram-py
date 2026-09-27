"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import api from "@/lib/http";
import type { AlertList } from "@/types/memecoin";

const TABS = [
  { href: "/memecoin", label: "Search" },
  { href: "/memecoin/history", label: "History" },
  { href: "/memecoin/wallets", label: "Wallets" },
  { href: "/memecoin/journal", label: "Journal" },
  { href: "/memecoin/watch", label: "Watch" },
];
// How often the unseen-alert badge refreshes while a memecoin page is open.
const BADGE_REFRESH_MS = 60_000;

export default function MemecoinNav() {
  const pathname = usePathname();
  const [unseen, setUnseen] = useState(0);
  const activeTab = useRef<HTMLAnchorElement>(null);
  // Search also covers the live report pages under /memecoin/<chain>/<address>.
  const active =
    TABS.slice(1).find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))?.href ?? "/memecoin";

  useEffect(() => {
    let active = true;
    const refresh = () =>
      api
        .get<AlertList>("/memecoin/alerts", { params: { limit: 1 } })
        .then((response) => {
          if (active) setUnseen(response.data.unseen);
        })
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, BADGE_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // Also on navigation, so the badge clears after "Mark all seen" on the Watch page.
  }, [pathname]);

  useEffect(() => {
    // On a narrow screen the tabs can scroll sideways; keep the current one in
    // view, also once web fonts load and after the badge widens the Watch tab.
    const reveal = () => activeTab.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    reveal();
    document.fonts?.ready.then(reveal);
  }, [active, unseen]);

  return (
    <nav aria-label="Memecoin" className="flex gap-0 overflow-x-auto border-b border-skin-border sm:gap-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          ref={tab.href === active ? activeTab : undefined}
          aria-current={tab.href === active ? "page" : undefined}
          className={`-mb-px shrink-0 border-b-2 px-2 py-2 text-[13px] no-underline sm:px-3 sm:text-sm ${
            tab.href === active ? "border-skin-accent font-medium text-skin-text" : "border-transparent text-skin-dim hover:text-skin-text"
          }`}
        >
          {tab.label}
          {tab.href === "/memecoin/watch" && unseen > 0 && (
            <span className="ml-1.5 rounded-full bg-skin-accent px-1.5 text-[11px] font-semibold text-theme-contrast">
              {unseen}
              <span className="sr-only"> unseen alerts</span>
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

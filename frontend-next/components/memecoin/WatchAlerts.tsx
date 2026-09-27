"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import api from "@/lib/http";
import { errorMessage } from "@/lib/api-errors";
import PrimaryButton from "@/components/button/PrimaryButton";
import SecondaryButton from "@/components/button/SecondaryButton";
import type { Alert, AlertList, WatchResult, WatchStatus } from "@/types/memecoin";
import { shortAddress, tokens } from "./format";
import { Panel } from "./ReportView";

// How often the open page asks for new alerts. A check itself runs on the
// button, or from the command line on a schedule.
const REFRESH_MS = 60_000;

function who(alert: Alert): string {
  return alert.wallet_label ?? (alert.wallet_list === "good_dev" ? "Good dev" : "Watched wallet");
}

function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export default function WatchAlerts() {
  const [status, setStatus] = useState<WatchStatus | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [unseen, setUnseen] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<WatchResult | null>(null);
  const [checkError, setCheckError] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  // Alert ids already shown, so a browser notification fires only for new ones.
  const known = useRef<Set<number> | null>(null);

  const load = useCallback(async () => {
    const [statusResponse, alertsResponse] = await Promise.all([
      api.get<WatchStatus>("/memecoin/watch"),
      api.get<AlertList>("/memecoin/alerts"),
    ]);
    const fresh = alertsResponse.data.alerts;
    if (known.current !== null && notificationsSupported() && Notification.permission === "granted") {
      for (const alert of fresh.filter((item) => !item.seen && !known.current?.has(item.id))) {
        new Notification(`${who(alert)} gained ${tokens(alert.amount)} tokens`, { body: alert.mint });
      }
    }
    known.current = new Set(fresh.map((item) => item.id));
    setStatus(statusResponse.data);
    setAlerts(fresh);
    setUnseen(alertsResponse.data.unseen);
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      load().catch((err) => {
        if (active) setLoadError(errorMessage(err, "Could not load the alerts."));
      });
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    // Read once after mounting: the server render has no Notification object.
    const current = notificationsSupported() ? Notification.permission : "unsupported";
    const timer = setTimeout(() => setPermission(current), 0);
    return () => clearTimeout(timer);
  }, []);

  async function checkNow() {
    setChecking(true);
    setCheckError("");
    setResult(null);
    try {
      const response = await api.post<WatchResult>("/memecoin/watch/check");
      setResult(response.data);
      await load();
    } catch (err) {
      setCheckError(errorMessage(err, "The check failed. Try again."));
    } finally {
      setChecking(false);
    }
  }

  async function markSeen() {
    try {
      await api.post("/memecoin/alerts/seen");
      setAlerts((current) => (current ?? []).map((alert) => ({ ...alert, seen: true })));
      setUnseen(0);
    } catch (err) {
      setCheckError(errorMessage(err, "Could not mark the alerts as seen."));
    }
  }

  async function enableNotifications() {
    if (!notificationsSupported()) return;
    setPermission(await Notification.requestPermission());
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-[10px] border border-skin-border bg-skin-panel p-5">
        <h2 className="m-0 text-[15px] font-semibold text-skin-text">Watched wallets</h2>
        <p className="m-0 text-sm text-skin-text">
          {status === null
            ? "Loading…"
            : status.wallets === 0
              ? "No wallets are watched yet."
              : `${status.wallets} ${status.wallets === 1 ? "wallet" : "wallets"} watched (good devs and the watch list). Last check: ${
                  status.last_checked_at ? new Date(status.last_checked_at).toLocaleString() : "never"
                }.`}
        </p>
        {status?.wallets === 0 && (
          <p className="m-0 text-sm text-skin-dim">
            Add wallets to <Link href="/memecoin/wallets" className="text-skin-accent">Good devs or the Watch list</Link>.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton type="button" disabled={checking || status?.wallets === 0} onClick={checkNow}>
            {checking ? "Checking…" : "Check now"}
          </PrimaryButton>
          {unseen > 0 && <SecondaryButton onClick={markSeen}>Mark all seen</SecondaryButton>}
          {permission === "default" && <SecondaryButton onClick={enableNotifications}>Enable browser notifications</SecondaryButton>}
        </div>
        {result && (
          <p role="status" className="m-0 text-sm text-skin-dim">
            Checked {result.wallets_checked} {result.wallets_checked === 1 ? "wallet" : "wallets"}: {result.new_alerts} new{" "}
            {result.new_alerts === 1 ? "alert" : "alerts"}.
          </p>
        )}
        {result && Object.keys(result.errors).length > 0 && (
          <ul className="m-0 list-none p-0 text-xs text-skin-danger">
            {Object.entries(result.errors).map(([source, reason]) => (
              <li key={source} className="break-all">
                {source === "telegram" ? "Telegram" : shortAddress(source)}: {reason}
              </li>
            ))}
          </ul>
        )}
        {checkError && <p role="alert" className="m-0 text-[13px] text-skin-danger">{checkError}</p>}
        <p className="m-0 text-xs text-skin-dim">
          Browser notifications: {permission === "granted" ? "on while this page is open" : permission === "denied" ? "blocked in this browser" : permission === "unsupported" ? "not supported here" : "off"}.
          Telegram: {status?.telegram ? "on" : "off (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in backend/.env)"}. Checks run on the
          button; for automatic checks run <code>python -m app.helpers.memecoin.watch --every 300</code> from backend/.
        </p>
      </section>

      {loadError && (
        <Panel title="Alerts unavailable">
          <p role="alert" className="m-0 text-sm text-skin-danger">{loadError}</p>
        </Panel>
      )}

      {alerts !== null && (
        <Panel title={`Alerts${unseen > 0 ? ` (${unseen} new)` : ""}`}>
          {alerts.length === 0 ? (
            <p className="m-0 text-sm text-skin-dim">No alerts yet. A watched wallet gaining a token shows up here.</p>
          ) : (
            <ul className="m-0 list-none divide-y divide-skin-border p-0">
              {alerts.map((alert) => (
                <li key={alert.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="m-0 text-skin-text">
                      {!alert.seen && <span className="mr-2 rounded bg-skin-accent px-1.5 text-[11px] font-semibold uppercase text-theme-contrast">new</span>}
                      <span className="font-medium">{who(alert)}</span>{" "}
                      <span className="font-mono text-xs text-skin-dim">{shortAddress(alert.wallet_address)}</span> gained{" "}
                      <span className="font-mono">{tokens(alert.amount)}</span> of <span className="font-mono">{shortAddress(alert.mint)}</span>
                    </p>
                    <p className="m-0 mt-1 text-xs text-skin-dim">{new Date(alert.block_time ?? alert.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex shrink-0 gap-3 text-xs">
                    <Link href={`/memecoin/solana/${alert.mint}`} className="text-skin-accent">
                      Check the coin
                    </Link>
                    <a href={`https://solscan.io/tx/${alert.signature}`} target="_blank" rel="noopener noreferrer" className="text-skin-accent">
                      Transaction ↗
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

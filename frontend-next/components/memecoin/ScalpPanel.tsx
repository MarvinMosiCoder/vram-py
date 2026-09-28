"use client";

import { useEffect, useState } from "react";
import api from "@/lib/http";
import { errorMessage } from "@/lib/api-errors";
import type { CoinReport, MarketData } from "@/types/memecoin";
import { count, pct, usd } from "./format";
import { DEFAULT_FILTERS, FILTER_LABELS, scalpSetup, type ScalpFilters } from "./scalp";

type Snapshot = { market: MarketData | null; fetched_at: string };

// Fixed green status colors stay readable regardless of the role's accent color.
const PASS_STYLE = "inline-flex rounded bg-emerald-950 px-2 py-0.5 font-semibold text-emerald-300";

export default function ScalpPanel({ report, live }: { report: CoinReport; live: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ market: report.market, fetched_at: report.checked_at });
  const [filters, setFilters] = useState<ScalpFilters>(DEFAULT_FILTERS);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!live) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await api.get<Snapshot>(`/memecoin/market/${report.chain}/${report.address}`, { signal: controller.signal, timeout: 15000 });
        if (active) { setSnapshot(response.data); setError(""); setNow(Date.now()); }
      } catch (err) {
        if (active) setError(errorMessage(err, "Market refresh failed."));
      } finally {
        if (active) timer = setTimeout(refresh, 30000);
      }
    }
    void refresh();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; controller.abort(); clearTimeout(timer); clearInterval(clock); };
  }, [live, report.chain, report.address]);

  const market = snapshot.market;
  const marketAge = now - Date.parse(snapshot.fetched_at);
  const safetyAge = now - Date.parse(report.checked_at);
  const stale = live && (Boolean(error) || !Number.isFinite(marketAge) || marketAge > 60000 || !Number.isFinite(safetyAge) || safetyAge > 300000);
  const setup = scalpSetup(market, report.assessment.verdict, filters, stale);
  return (
    <section className="rounded-[10px] border border-skin-border bg-skin-panel p-5">
      <h3 className="m-0 text-[15px] font-semibold text-skin-text">Quick scalp setup</h3>
      <p role="status" className={`my-3 font-semibold ${setup.status === "Matches scalp filters" ? PASS_STYLE : "text-skin-text"}`}>
        {live ? "" : "Saved snapshot: "}{setup.status}
      </p>
      <p className="text-xs text-skin-dim">Risk assessment: {report.assessment.verdict}. Safety checked {new Date(report.checked_at).toLocaleString()}.</p>
      <dl className="m-0 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {setup.checks.map((check) => (
          <div key={check.key} className="flex flex-wrap justify-between gap-2 border-b border-skin-border py-2 text-sm">
            <dt className="text-skin-dim">{FILTER_LABELS[check.key]}</dt>
            <dd className="m-0 text-skin-text">
              {check.key === "trades_5m" ? count(check.value) : check.key === "liquidity_mc_pct" ? pct(check.value) : usd(check.value)} · {" "}
              <span className={check.pass === true ? PASS_STYLE : "text-skin-dim"}>
                {check.pass === null ? "Unknown" : check.pass ? "Pass" : "Below minimum"}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-skin-text">Activity: {setup.momentum === null ? "Unknown (needs a full hour of volume)" : setup.momentum ? "Accelerating" : "Not accelerating"} · Pool depth: {(market?.liquidity_usd ?? 0) >= 100000 ? "$100K+" : "Below $100K or unknown"}</p>
      <p className="text-xs text-skin-dim">FDV: {usd(market?.fdv ?? null)} · Price change: {pct(market?.price_change_5m ?? null)} / 5m, {pct(market?.price_change_1h ?? null)} / 1h</p>
      <p className="text-xs text-skin-dim break-all">Pool: {market?.pair_address ?? "Unknown"} · {market?.dex ?? "Unknown DEX"}</p>
      <p className="text-xs text-skin-dim">Market fetched {new Date(snapshot.fetched_at).toLocaleString()}.{live ? " Refreshes every 30 seconds after each request. Provider data may lag." : " Historical data; no live refresh."}</p>
      {error && <p role="alert" className="text-sm text-skin-danger">{error} Previous values are shown.</p>}
      {live && safetyAge > 300000 && <p className="text-sm text-skin-danger">Safety report is over 5 minutes old. Refresh the full report before using this setup.</p>}
      <details className="mt-3 text-sm text-skin-text">
        <summary className="cursor-pointer">Adjust minimums</summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(Object.keys(filters) as (keyof ScalpFilters)[]).map((key) => (
            <label key={key} className="flex flex-col gap-1">{FILTER_LABELS[key]}{key === "trades_5m" ? "" : key === "liquidity_mc_pct" ? " (%)" : " (USD)"}
              <input type="number" min="0" step={key === "liquidity_mc_pct" ? "0.1" : "1"} value={filters[key]} onChange={(event) => {
                const value = event.target.valueAsNumber;
                if (Number.isFinite(value) && value >= 0) setFilters({ ...filters, [key]: value });
              }} className="w-full rounded border border-skin-border bg-skin-panel p-2 text-skin-text" />
            </label>
          ))}
        </div>
        <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="mt-3 text-skin-accent">Reset defaults</button>
        <p className="text-xs text-skin-dim">Settings apply to this view only. Acceleration compares the last 5 minutes with the preceding 55-minute average rate.</p>
      </details>
      <p className="mb-0 text-xs text-skin-dim">Experimental screening filters, not a buy signal. Volume may include wash trading; fees, price impact and execution quality are not checked.</p>
    </section>
  );
}

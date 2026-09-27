"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import api from "@/lib/http";
import { errorMessage } from "@/lib/api-errors";
import TextInput from "@/components/form/TextInput";
import PrimaryButton from "@/components/button/PrimaryButton";
import SecondaryButton from "@/components/button/SecondaryButton";
import type { ReportSummary } from "@/types/memecoin";
import { shortAddress } from "./format";
import { Panel, VerdictBadge } from "./ReportView";
import { chainName, isAnyAddress } from "./chains";

// Mirrors the default `limit` of GET /memecoin/reports.
const PAGE_SIZE = 50;

async function fetchPage(address: string, offset: number): Promise<ReportSummary[]> {
  const params: Record<string, string | number> = { limit: PAGE_SIZE, offset };
  if (address) params.address = address;
  const response = await api.get<ReportSummary[]>("/memecoin/reports", { params });
  return response.data;
}

export default function ReportHistory() {
  const [rows, setRows] = useState<ReportSummary[] | null>(null);
  const [error, setError] = useState("");
  // The address the list is filtered by; "" lists every coin.
  const [filter, setFilter] = useState("");
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPage(filter, 0)
      .then((page) => {
        if (!active) return;
        setRows(page);
        setHasMore(page.length === PAGE_SIZE);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err, "Could not load the history."));
      });
    return () => {
      active = false;
    };
  }, [filter, attempt]);

  function reload(address: string) {
    setRows(null);
    setError("");
    if (address === filter) setAttempt((n) => n + 1);
    else setFilter(address);
  }

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = input.trim();
    if (address && !isAnyAddress(address)) {
      setInputError("Enter a full Solana or EVM token address.");
      return;
    }
    setInputError("");
    reload(address);
  }

  function clearFilter() {
    setInput("");
    setInputError("");
    reload("");
  }

  async function loadMore() {
    if (!rows) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(filter, rows.length);
      setRows([...rows, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setError(errorMessage(err, "Could not load more reports."));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={applyFilter} className="flex flex-col gap-3 rounded-[10px] border border-skin-border bg-skin-panel p-5">
        <label htmlFor="history-address" className="text-sm font-medium text-skin-text">
          Saved reports for one token address
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextInput
            id="history-address"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Leave empty to list every coin"
            autoComplete="off"
          />
          <div className="flex shrink-0 gap-2">
            <PrimaryButton>Filter</PrimaryButton>
            {filter && <SecondaryButton onClick={clearFilter}>Clear</SecondaryButton>}
          </div>
        </div>
        {inputError && <p role="alert" className="m-0 text-[13px] text-skin-danger">{inputError}</p>}
        <p className="m-0 text-xs text-skin-dim">Every report the analyzer fetches is saved here, newest first.</p>
      </form>

      {error && (
        <Panel title="History unavailable">
          <p role="alert" className="m-0 text-sm text-skin-danger">{error}</p>
          <div className="mt-3">
            <SecondaryButton onClick={() => reload(filter)}>Retry</SecondaryButton>
          </div>
        </Panel>
      )}

      {!error && rows === null && (
        <p role="status" className="m-0 text-sm text-skin-dim">Loading saved reports…</p>
      )}

      {rows !== null && (
        <div className="rounded-[10px] border border-skin-border bg-skin-panel">
          {rows.length === 0 ? (
            <p className="m-0 p-5 text-sm text-skin-dim">
              {filter ? "No saved reports for this address." : "No saved reports yet. Analyze a coin and it is saved here."}
            </p>
          ) : (
            <ul className="m-0 list-none divide-y divide-skin-border p-0">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/memecoin/history/${row.id}`}
                    className="flex flex-col gap-2 px-5 py-3 text-skin-text no-underline hover:bg-skin-border/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{row.symbol ?? "?"}</span>{" "}
                      <span className="text-sm text-skin-dim">{row.name}</span>
                      <span className="block font-mono text-xs text-skin-dim">
                        {chainName(row.chain)} · {shortAddress(row.address)} · {new Date(row.checked_at).toLocaleString()}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <VerdictBadge verdict={row.verdict} />
                      <span className="font-mono text-xs text-skin-dim">risk {row.score}/100</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rows !== null && hasMore && (
        <div>
          <SecondaryButton disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </SecondaryButton>
        </div>
      )}
    </div>
  );
}

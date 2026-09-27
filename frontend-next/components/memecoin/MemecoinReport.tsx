"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/http";
import { errorMessage } from "@/lib/api-errors";
import SecondaryButton from "@/components/button/SecondaryButton";
import type { CoinReport } from "@/types/memecoin";
import ReportView, { Panel, journalHref } from "./ReportView";

export default function MemecoinReport({ chain, address }: { chain: string; address: string }) {
  const [report, setReport] = useState<CoinReport | null>(null);
  const [error, setError] = useState("");
  // Retry bumps this to run the effect again.
  const [attempt, setAttempt] = useState(0);
  const [blacklistStatus, setBlacklistStatus] = useState("");
  const [blacklisting, setBlacklisting] = useState(false);

  useEffect(() => {
    // Ignore an answer that arrives after the page was left or retried.
    let active = true;
    api
      .get<CoinReport>(`/memecoin/analyze/${chain}/${address}`)
      .then((response) => {
        if (active) setReport(response.data);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err, "Could not load the report. Try again."));
      });
    return () => {
      active = false;
    };
  }, [chain, address, attempt]);

  function retry() {
    setError("");
    setReport(null);
    setAttempt((n) => n + 1);
  }

  // The backend forgets cached reports when the blacklist changes, so
  // reloading re-judges the coin with the creator on it.
  async function blacklistCreator(creator: string) {
    setBlacklisting(true);
    setBlacklistStatus("");
    try {
      await api.post("/memecoin/wallets", { address: creator, list: "blacklist", label: "scam dev" });
      setBlacklistStatus("Creator added to the blacklist.");
      retry();
    } catch (err) {
      setBlacklistStatus(errorMessage(err, "Could not add the creator to the blacklist."));
    } finally {
      setBlacklisting(false);
    }
  }

  const creator = report?.safety?.creator ?? null;
  const creatorBlacklisted = report?.assessment.findings.some((finding) => finding.rule === "creator_blacklisted") ?? false;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/memecoin" className="self-start text-sm text-skin-dim no-underline hover:text-skin-accent">
        ← Back to search
      </Link>

      {blacklistStatus && (
        <p role="status" className="m-0 text-sm text-skin-dim">
          {blacklistStatus}
        </p>
      )}

      {error ? (
        <Panel title="Report unavailable">
          <p role="alert" className="m-0 text-sm text-skin-danger">{error}</p>
          <div className="mt-3">
            <SecondaryButton onClick={retry}>Retry</SecondaryButton>
          </div>
        </Panel>
      ) : report === null ? (
        <Panel title="Checking the coin…">
          <p role="status" className="m-0 text-sm text-skin-dim">
            Asking DexScreener and RugCheck. Large coins can take up to 30 seconds.
          </p>
        </Panel>
      ) : (
        <ReportView
          report={report}
          actions={
            <>
              <Link
                href={journalHref(report)}
                className="rounded-md border border-skin-border px-3.5 py-1.75 text-[13px] font-medium text-skin-dim no-underline hover:bg-skin-border hover:text-skin-text"
              >
                Log a trade
              </Link>
              {creator && !creatorBlacklisted && (
                <SecondaryButton disabled={blacklisting} onClick={() => blacklistCreator(creator)}>
                  {blacklisting ? "Adding…" : "Add creator to blacklist"}
                </SecondaryButton>
              )}
            </>
          }
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/http";
import { errorMessage } from "@/lib/api-errors";
import type { SavedReport } from "@/types/memecoin";
import ReportView, { Panel, journalHref } from "./ReportView";

export default function SavedReportView({ id }: { id: string }) {
  const [saved, setSaved] = useState<SavedReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get<SavedReport>(`/memecoin/reports/${id}`)
      .then((response) => {
        if (active) setSaved(response.data);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err, "Could not load the saved report."));
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/memecoin/history" className="self-start text-sm text-skin-dim no-underline hover:text-skin-accent">
        ← Back to history
      </Link>

      {error ? (
        <Panel title="Saved report unavailable">
          <p role="alert" className="m-0 text-sm text-skin-danger">{error}</p>
        </Panel>
      ) : saved === null ? (
        <p role="status" className="m-0 text-sm text-skin-dim">Loading the saved report…</p>
      ) : (
        <ReportView
          report={saved.report}
          note={
            <p className="m-0 rounded-md border border-skin-border px-3 py-2 text-xs text-skin-dim">
              Saved report. The coin may have changed since it was checked.{" "}
              <Link href={`/memecoin/${saved.chain}/${saved.address}`} className="text-skin-accent">
                Check it again now
              </Link>
            </p>
          }
          actions={
            <Link
              href={journalHref(saved.report, saved.id)}
              className="rounded-md border border-skin-border px-3.5 py-1.75 text-[13px] font-medium text-skin-dim no-underline hover:bg-skin-border hover:text-skin-text"
            >
              Log a trade from this report
            </Link>
          }
        />
      )}
    </div>
  );
}

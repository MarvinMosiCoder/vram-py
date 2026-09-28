"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import api from "@/lib/http";
import { errorMessage } from "@/lib/api-errors";
import PrimaryButton from "@/components/button/PrimaryButton";
import SecondaryButton from "@/components/button/SecondaryButton";
import { CHAINS, chainById, isValidAddress } from "./chains";
import { date, usd } from "./format";
import WalletAddress from "./WalletAddress";
import type { ChainId } from "@/types/memecoin";

type Relationship = "creator" | "owner";
type Query = { chain: ChainId; address: string; relationship: Relationship; offset: number };
type Result = Query & {
  total: number; limit: number; coverage: "saved_reports";
  tokens: { address: string; name: string | null; symbol: string | null; market_cap: number | null; created_at: string | null; observed_at: string; source: string; report_id: number | null }[];
};

export default function WalletSearch({ initialAddress, initialChain, initialRelationship }: { initialAddress: string; initialChain: string; initialRelationship: Relationship }) {
  const firstChain = chainById(initialChain) ?? CHAINS[0];
  const firstRelationship = firstChain.family === "solana" ? "creator" : initialRelationship;
  const [address, setAddress] = useState(initialAddress);
  const [chain, setChain] = useState<ChainId>(firstChain.id);
  const [relationship, setRelationship] = useState<Relationship>(firstRelationship);
  const [query, setQuery] = useState<Query | null>(() => isValidAddress(firstChain, initialAddress) ? { chain: firstChain.id, address: initialAddress, relationship: firstRelationship, offset: 0 } : null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState(initialAddress && !isValidAddress(firstChain, initialAddress) ? "Enter a valid wallet address for the selected chain." : "");
  const [loading, setLoading] = useState(Boolean(query));

  useEffect(() => {
    if (!query) return;
    let active = true;
    const controller = new AbortController();
    api.get<Result>(`/memecoin/wallet-tokens/${query.chain}/${query.address}`, {
      params: { relationship: query.relationship, offset: query.offset, limit: 50 }, signal: controller.signal, timeout: 15000,
    }).then(({ data }) => { if (active) setResult(data); })
      .catch((err) => { if (active) setError(errorMessage(err, "Wallet search failed. Try again.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidAddress(chainById(chain)!, address.trim())) {
      setError("Enter a valid wallet address for the selected chain.");
      return;
    }
    search({ chain, address: address.trim(), relationship, offset: 0 });
  }
  function search(next: Query) { setError(""); setResult(null); setLoading(true); setQuery(next); }
  const control = "min-w-0 rounded border border-skin-border bg-skin-panel p-2 text-sm text-skin-text";
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="rounded-[10px] border border-skin-border bg-skin-panel p-5">
        <h2 className="mt-0 text-lg font-semibold text-skin-text">Search a creator wallet</h2>
        <p className="text-sm text-skin-dim">Find coins linked to a creator, or EVM contracts linked to a current owner. Ownership does not mean that wallet created the coin.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-skin-text">Chain
            <select className={control} value={chain} onChange={(event) => { setChain(event.target.value as ChainId); if (event.target.value === "solana") setRelationship("creator"); }}>
              {CHAINS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-skin-text">Relationship
            <select className={control} value={relationship} onChange={(event) => setRelationship(event.target.value as Relationship)}>
              <option value="creator">Created coins</option>
              {chain !== "solana" && <option value="owner">Owned contracts</option>}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-skin-text sm:col-span-2">Wallet address
            <input className={control} value={address} onChange={(event) => setAddress(event.target.value)} maxLength={44} autoComplete="off" spellCheck={false} required />
          </label>
        </div>
        <PrimaryButton disabled={loading} className="mt-3">{loading ? "Searching…" : "Search wallet"}</PrimaryButton>
        {error && <p role="alert" className="mb-0 text-sm text-skin-danger">{error}</p>}
        <p className="mb-0 text-xs text-skin-dim">Coverage: saved reports and recorded RugCheck creator history on Solana. This is not a complete blockchain history or a list of wallet holdings. Analyze a known token to add its available creator history.</p>
      </form>
      {loading && <p role="status" className="text-sm text-skin-dim">Looking for known coins…</p>}
      {result && (
        <section className="rounded-[10px] border border-skin-border bg-skin-panel p-5">
          <h3 className="mt-0 text-base text-skin-text">{result.total} known {result.relationship === "creator" ? "created coins" : "owned contracts"} · {chainById(result.chain)?.name}</h3>
          <div className="flex text-skin-text"><WalletAddress address={result.address} chain={result.chain} relationship={result.relationship} /></div>
          {result.total === 0 ? <p className="text-sm text-skin-dim">No records found here. This does not mean this wallet has created no coins.</p> : (
            <ul className="mt-4 list-none divide-y divide-skin-border p-0">
              {result.tokens.map((token) => <li key={token.address} className="flex flex-col gap-1 py-3 text-sm">
                <Link href={`/memecoin/${result.chain}/${token.address}`} className="break-all text-skin-accent">{token.symbol || token.name || token.address}</Link>
                {(token.symbol || token.name) && <span className="break-all font-mono text-xs text-skin-dim">{token.address}</span>}
                <span className="text-skin-text">Recorded market cap: {usd(token.market_cap)} · Created: {date(token.created_at)}</span>
                <span className="text-xs text-skin-dim">{token.source} · Observed {new Date(token.observed_at).toLocaleString()}</span>
                {token.report_id !== null && <Link href={`/memecoin/history/${token.report_id}`} className="text-xs text-skin-accent">View saved report</Link>}
              </li>)}
            </ul>
          )}
          {result.total > 50 && <div className="mt-3 flex flex-wrap items-center gap-3">
            <SecondaryButton disabled={result.offset === 0} onClick={() => search({ ...result, offset: Math.max(0, result.offset - 50) })}>Previous</SecondaryButton>
            <span className="text-sm text-skin-dim">{result.offset + 1}–{Math.min(result.offset + 50, result.total)} of {result.total}</span>
            <SecondaryButton disabled={result.offset + 50 >= result.total} onClick={() => search({ ...result, offset: result.offset + 50 })}>Next</SecondaryButton>
          </div>}
        </section>
      )}
    </div>
  );
}

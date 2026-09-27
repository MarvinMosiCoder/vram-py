"use client";

import { useEffect, useState, type FormEvent } from "react";
import api from "@/lib/http";
import { errorMessage } from "@/lib/api-errors";
import TextInput from "@/components/form/TextInput";
import PrimaryButton from "@/components/button/PrimaryButton";
import SecondaryButton from "@/components/button/SecondaryButton";
import DangerButton from "@/components/button/DangerButton";
import type { Wallet, WalletList } from "@/types/memecoin";
import { Panel } from "./ReportView";
import { isAnyAddress } from "./chains";

const LISTS: { value: WalletList; title: string; help: string }[] = [
  {
    value: "blacklist",
    title: "Blacklist",
    help: "A coin whose creator is on this list is Avoid; a top-10 holder on it adds a warning. Scam devs and bundle wallets go here.",
  },
  {
    value: "good_dev",
    title: "Good devs",
    help: "Creators worth following. Solana wallets are watched for buys and launches on the Watch tab; it does not change verdicts.",
  },
  {
    value: "watch",
    title: "Watch list",
    help: "Traders and influencers to follow. Solana wallets are watched for buys on the Watch tab; EVM wallets are not watched yet.",
  },
];

const EMPTY_FORM = { address: "", list: "blacklist" as WalletList, label: "", note: "" };

export default function WalletLists() {
  const [wallets, setWallets] = useState<Wallet[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  // The wallet whose Delete was clicked once and awaits confirmation.
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get<Wallet[]>("/memecoin/wallets")
      .then((response) => {
        if (active) setWallets(response.data);
      })
      .catch((err) => {
        if (active) setLoadError(errorMessage(err, "Could not load the wallet lists."));
      });
    return () => {
      active = false;
    };
  }, []);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = form.address.trim();
    if (!isAnyAddress(address)) {
      setFormError("Enter a full Solana or EVM wallet address.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await api.post<Wallet>("/memecoin/wallets", {
        address,
        list: form.list,
        label: form.label.trim() || null,
        note: form.note.trim() || null,
      });
      setWallets((current) => [response.data, ...(current ?? [])]);
      setForm({ ...EMPTY_FORM, list: form.list });
    } catch (err) {
      setFormError(errorMessage(err, "Could not add the wallet."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(wallet: Wallet) {
    setDeleteError("");
    try {
      await api.delete(`/memecoin/wallets/${wallet.id}`);
      setWallets((current) => (current ?? []).filter((item) => item.id !== wallet.id));
    } catch (err) {
      setDeleteError(errorMessage(err, "Could not delete the wallet."));
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex flex-col gap-3 rounded-[10px] border border-skin-border bg-skin-panel p-5">
        <h2 className="m-0 text-[15px] font-semibold text-skin-text">Add a wallet</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-skin-text sm:col-span-2">
            Wallet address
            <TextInput value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-skin-text">
            List
            <select
              value={form.list}
              onChange={(event) => setForm({ ...form, list: event.target.value as WalletList })}
              className="w-full rounded-md border border-skin-border bg-skin-bg px-3 py-2.5 font-body text-sm text-skin-text focus:outline-2 focus:outline-offset-1 focus:outline-skin-accent"
            >
              {LISTS.map((list) => (
                <option key={list.value} value={list.value}>
                  {list.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-skin-text">
            Label (optional)
            <TextInput value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} maxLength={100} placeholder="scam dev, bundle wallet…" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-skin-text sm:col-span-2">
            Note (optional)
            <TextInput value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} maxLength={1000} placeholder="Why it is on the list" />
          </label>
        </div>
        {formError && <p role="alert" className="m-0 text-[13px] text-skin-danger">{formError}</p>}
        <div>
          <PrimaryButton disabled={saving}>{saving ? "Adding…" : "Add wallet"}</PrimaryButton>
        </div>
      </form>

      {loadError && (
        <Panel title="Wallet lists unavailable">
          <p role="alert" className="m-0 text-sm text-skin-danger">{loadError}</p>
        </Panel>
      )}
      {!loadError && wallets === null && <p role="status" className="m-0 text-sm text-skin-dim">Loading wallet lists…</p>}
      {deleteError && <p role="alert" className="m-0 text-sm text-skin-danger">{deleteError}</p>}

      {wallets !== null &&
        LISTS.map((list) => {
          const items = wallets.filter((wallet) => wallet.list === list.value);
          return (
            <Panel key={list.value} title={`${list.title} (${items.length})`}>
              <p className="m-0 mb-3 text-xs text-skin-dim">{list.help}</p>
              {items.length === 0 ? (
                <p className="m-0 text-sm text-skin-dim">No wallets yet.</p>
              ) : (
                <ul className="m-0 list-none divide-y divide-skin-border p-0">
                  {items.map((wallet) => (
                    <li key={wallet.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 text-sm">
                        <p className="m-0 break-all font-mono text-xs text-skin-text">{wallet.address}</p>
                        <p className="m-0 mt-1 text-skin-dim">
                          {[wallet.label, wallet.note].filter(Boolean).join(" · ") || "No label"} · added{" "}
                          {new Date(wallet.created_at).toLocaleDateString()}
                          {wallet.list !== "blacklist" &&
                            ` · ${wallet.last_checked_at ? `checked ${new Date(wallet.last_checked_at).toLocaleString()}` : "not checked yet"}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {confirmingId === wallet.id ? (
                          <>
                            <DangerButton type="button" onClick={() => remove(wallet)}>
                              Confirm delete
                            </DangerButton>
                            <SecondaryButton onClick={() => setConfirmingId(null)}>Cancel</SecondaryButton>
                          </>
                        ) : (
                          <SecondaryButton onClick={() => setConfirmingId(wallet.id)} aria-label={`Delete ${wallet.address}`}>
                            Delete
                          </SecondaryButton>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
    </div>
  );
}

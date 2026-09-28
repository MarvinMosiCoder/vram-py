import type { Metadata } from "next";
import WalletSearch from "@/components/memecoin/WalletSearch";

export const metadata: Metadata = { title: "Wallet search" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const address = typeof params.address === "string" ? params.address : "";
  const chain = typeof params.chain === "string" ? params.chain : "solana";
  const relationship = params.relationship === "owner" ? "owner" : "creator";
  return <WalletSearch key={`${chain}:${address}:${relationship}`} initialAddress={address} initialChain={chain} initialRelationship={relationship} />;
}

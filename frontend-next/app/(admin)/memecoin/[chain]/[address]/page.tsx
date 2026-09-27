import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MemecoinReport from "@/components/memecoin/MemecoinReport";
import { chainById, isValidAddress } from "@/components/memecoin/chains";

export const metadata: Metadata = { title: "Coin report" };

export default async function Page({ params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await params;
  // The API would answer 422, so a URL it cannot serve is not a page.
  const network = chainById(chain);
  if (!network || !isValidAddress(network, address)) notFound();
  return <MemecoinReport key={`${chain}/${address}`} chain={chain} address={address} />;
}

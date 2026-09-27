import type { Metadata } from "next";
import WalletLists from "@/components/memecoin/WalletLists";

export const metadata: Metadata = { title: "Wallet lists" };

export default function Page() {
  return <WalletLists />;
}

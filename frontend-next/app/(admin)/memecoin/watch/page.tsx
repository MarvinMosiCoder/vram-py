import type { Metadata } from "next";
import WatchAlerts from "@/components/memecoin/WatchAlerts";

export const metadata: Metadata = { title: "Wallet alerts" };

export default function Page() {
  return <WatchAlerts />;
}

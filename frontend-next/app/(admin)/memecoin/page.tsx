import type { Metadata } from "next";
import MemecoinSearch from "@/components/memecoin/MemecoinSearch";

export const metadata: Metadata = { title: "Memecoin" };

export default function Page() {
  return <MemecoinSearch />;
}

import type { Metadata } from "next";
import ReportHistory from "@/components/memecoin/ReportHistory";

export const metadata: Metadata = { title: "Report history" };

export default function Page() {
  return <ReportHistory />;
}

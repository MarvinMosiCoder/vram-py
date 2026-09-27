import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SavedReportView from "@/components/memecoin/SavedReportView";

export const metadata: Metadata = { title: "Saved report" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) notFound();
  return <SavedReportView key={id} id={id} />;
}

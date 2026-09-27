import type { Metadata } from "next";
import TradeJournal from "@/components/memecoin/TradeJournal";

export const metadata: Metadata = { title: "Trade journal" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// "Log a trade" links arrive with ?chain=&address=&symbol=&price=&report= to fill in the form.
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
  return (
    <TradeJournal
      prefill={{
        chain: first(params.chain),
        address: first(params.address),
        symbol: first(params.symbol),
        price: first(params.price),
        report: first(params.report),
      }}
    />
  );
}

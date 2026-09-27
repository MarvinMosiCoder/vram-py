// Display helpers shared by the memecoin search and report. null means the
// backend did not know the value, shown as "?" rather than 0.
import type { MarketData } from "@/types/memecoin";

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function usd(value: number | null): string {
  return value === null ? "?" : compactUsd.format(value);
}

// DexScreener's total counts a pool without a liquidity figure (a pump.fun
// bonding curve) as $0. Show unknown instead, as the rule engine does.
export function liquidity(token: MarketData): string {
  return usd(token.liquidity_usd === null ? null : token.total_liquidity_usd);
}

export function age(hours: number | null): string {
  if (hours === null) return "?";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours / 24)}d`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

// Coin prices can be tiny: 4 significant digits keeps $0.000003644 readable.
const priceUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumSignificantDigits: 4,
});

export function price(value: number | null): string {
  return value === null ? "?" : priceUsd.format(value);
}

export function pct(value: number | null): string {
  return value === null ? "?" : `${value.toFixed(1)}%`;
}

export function count(value: number | null): string {
  return value === null ? "?" : value.toLocaleString("en-US");
}

const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

// Token amounts: 96449438 -> "96.4M".
export function tokens(value: number): string {
  return compactNumber.format(value);
}

export function date(value: string | null): string {
  return value === null ? "?" : new Date(value).toLocaleDateString();
}

export function yesNo(value: boolean | null): string {
  return value === null ? "?" : value ? "Yes" : "No";
}


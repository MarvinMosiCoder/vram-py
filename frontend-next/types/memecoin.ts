// Mirrors backend/app/schemas/admin/memecoin.py; update both together.
// A Python field typed `X | None` arrives as null, never as a missing key.

// The chains in backend/app/helpers/memecoin/chains.py.
export type ChainId = "solana" | "ethereum" | "bsc" | "base" | "polygon" | "arbitrum" | "robinhood";

export type Social = {
  type: string | null;
  url: string;
};

export type PoolData = {
  chain: string;
  address: string;
  dex: string | null;
  name: string | null;
  symbol: string | null;
  pair_address: string | null;
  price_usd: number | null;
  liquidity_usd: number | null;
  volume_24h: number | null;
  buys_24h: number | null;
  sells_24h: number | null;
  age_hours: number | null;
  url: string | null;
  websites: string[];
  socials: Social[];
};

// GET /memecoin/search returns MarketData[].
export type MarketData = PoolData & {
  pools: number;
  total_liquidity_usd: number;
  total_volume_24h: number;
};

export type Holder = { owner: string | null; pct: number; insider: boolean; label: string | null };
export type Risk = { name: string; level: string | null; description: string | null };

// Another token by the same creator, per RugCheck.
export type CreatorToken = {
  mint: string;
  market_cap: number | null;
  created_at: string | null;
};

// Wallets RugCheck links by transfers; pct is the share of supply they hold now.
export type InsiderNetwork = {
  size: number;
  pct: number | null;
};

export type SafetyData = {
  mint: string;
  name: string | null;
  symbol: string | null;
  mint_authority: string | null;
  freeze_authority: string | null;
  mutable_metadata: boolean | null;
  transfer_fee_pct: number | null;
  lp_locked_pct: number | null;
  total_market_liquidity: number | null;
  total_holders: number | null;
  top10_pct: number | null;
  top10_insiders: number | null;
  top_holders: Holder[];
  creator: string | null;
  creator_pct: number | null;
  insiders_detected: number | null;
  launchpad: string | null;
  rugged: boolean;
  rugcheck_score: number | null;
  risks: Risk[];
  creator_tokens: CreatorToken[] | null; // null when the creator is unknown
  insider_networks: InsiderNetwork[];
  linked_wallets_pct: number | null;
  // EVM contract checks from GoPlus; null means GoPlus could not tell.
  honeypot: boolean | null;
  buy_tax_pct: number | null;
  sell_tax_pct: number | null;
  open_source: boolean | null;
  proxy: boolean | null;
  owner: string | null;
  owner_renounced: boolean | null;
  owner_can_mint: boolean | null;
  owner_can_change_balances: boolean | null;
  hidden_owner: boolean | null;
  can_reclaim_ownership: boolean | null;
  transfers_pausable: boolean | null;
  can_blacklist: boolean | null;
  creator_made_honeypots: boolean | null;
};

export type WebData = {
  website: string | null;
  domain: string | null;
  hosted: boolean; // a shared host such as vercel.app: its age is not checked
  domain_registered_at: string | null;
  domain_age_days: number | null;
  wayback_first_at: string | null;
  wayback_error: string | null;
};

export type Severity = "fail" | "warn";
export type Verdict = "Avoid" | "High risk" | "Watch";
export type Finding = { rule: string; severity: Severity; message: string };
export type Assessment = { score: number; verdict: Verdict; findings: Finding[]; unchecked: string[] };

// GET /memecoin/analyze/{chain}/{address}
export type CoinReport = {
  chain: ChainId;
  address: string;
  checked_at: string; // ISO 8601, UTC
  market: MarketData | null;
  safety: SafetyData | null;
  web: WebData | null;
  assessment: Assessment;
  errors: Record<string, string>; // failed source -> reason
};

// --- Storage (Phase 6) ---

// GET /memecoin/reports: one saved report in the history.
export type ReportSummary = {
  id: number;
  address: string;
  chain: ChainId;
  symbol: string | null;
  name: string | null;
  verdict: Verdict;
  score: number;
  checked_at: string; // ISO 8601, UTC
};

// GET /memecoin/reports/{id}
export type SavedReport = ReportSummary & { report: CoinReport };

export type WalletList = "blacklist" | "good_dev" | "watch";

// GET /memecoin/wallets
export type Wallet = {
  id: number;
  address: string;
  list: WalletList;
  label: string | null;
  note: string | null;
  created_at: string;
  last_checked_at: string | null;
};

// GET /memecoin/trades: one journal entry. pnl_pct is set once the trade is closed.
export type Trade = {
  id: number;
  chain: ChainId;
  address: string;
  symbol: string | null;
  entry_price: number;
  amount_usd: number | null;
  entry_reason: string;
  entered_at: string;
  exit_price: number | null;
  exit_reason: string | null;
  exited_at: string | null;
  report_id: number | null;
  pnl_pct: number | null;
  created_at: string;
  updated_at: string;
};

// --- Watching wallets (Phase 9) ---

// A watched wallet gained a token: usually a buy, or a dev's own launch.
export type Alert = {
  id: number;
  wallet_address: string;
  wallet_list: WalletList;
  wallet_label: string | null;
  mint: string;
  amount: number;
  signature: string;
  block_time: string | null;
  seen: boolean;
  created_at: string;
};

// GET /memecoin/alerts
export type AlertList = { alerts: Alert[]; unseen: number };

// GET /memecoin/watch
export type WatchStatus = { wallets: number; telegram: boolean; last_checked_at: string | null };

// POST /memecoin/watch/check
export type WatchResult = { wallets_checked: number; new_alerts: number; errors: Record<string, string> };

// Mirrors backend/app/helpers/memecoin/chains.py; add a chain in both places.
// The id is DexScreener's chainId and the {chain} in /memecoin/<chain>/<address>.
import type { ChainId } from "@/types/memecoin";

export type Chain = {
  id: ChainId;
  name: string;
  family: "solana" | "evm";
  // GoPlus's chain id, for EVM safety pages.
  goplusId: string | null;
  explorerName: string;
  explorerTokenUrl: string; // "{address}" is replaced
};

export const CHAINS: Chain[] = [
  { id: "solana", name: "Solana", family: "solana", goplusId: null, explorerName: "Solscan", explorerTokenUrl: "https://solscan.io/token/{address}" },
  { id: "ethereum", name: "Ethereum", family: "evm", goplusId: "1", explorerName: "Etherscan", explorerTokenUrl: "https://etherscan.io/token/{address}" },
  { id: "bsc", name: "BNB Smart Chain", family: "evm", goplusId: "56", explorerName: "BscScan", explorerTokenUrl: "https://bscscan.com/token/{address}" },
  { id: "base", name: "Base", family: "evm", goplusId: "8453", explorerName: "BaseScan", explorerTokenUrl: "https://basescan.org/token/{address}" },
  { id: "polygon", name: "Polygon", family: "evm", goplusId: "137", explorerName: "PolygonScan", explorerTokenUrl: "https://polygonscan.com/token/{address}" },
  { id: "arbitrum", name: "Arbitrum", family: "evm", goplusId: "42161", explorerName: "Arbiscan", explorerTokenUrl: "https://arbiscan.io/token/{address}" },
  {
    id: "robinhood",
    name: "Robinhood Chain",
    family: "evm",
    goplusId: "4663",
    explorerName: "Blockscout",
    explorerTokenUrl: "https://robinhoodchain.blockscout.com/token/{address}",
  },
];

const ADDRESS_PATTERNS = {
  // base58: 32-44 characters, without 0, O, I, or l
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  // 0x and 40 hex digits, in any letter case
  evm: /^0x[0-9a-fA-F]{40}$/,
};

export function chainById(id: string): Chain | undefined {
  return CHAINS.find((chain) => chain.id === id);
}

export function chainName(id: string): string {
  return chainById(id)?.name ?? id;
}

// Checking the address here saves a request the API would answer with 422.
export function isValidAddress(chain: Chain, address: string): boolean {
  return ADDRESS_PATTERNS[chain.family].test(address);
}

// For inputs that do not name a chain: wallet lists and the history filter.
export function isAnyAddress(address: string): boolean {
  return ADDRESS_PATTERNS.solana.test(address) || ADDRESS_PATTERNS.evm.test(address);
}

export function explorerUrl(chain: Chain, address: string): string {
  return chain.explorerTokenUrl.replace("{address}", address);
}

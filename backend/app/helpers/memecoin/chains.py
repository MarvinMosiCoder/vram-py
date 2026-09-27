"""The chains the analyzer covers, and what differs between them.

A chain's id is DexScreener's chainId, which is also the {chain} in
/memecoin/analyze/{chain}/{address}. Solana coins get their safety data from
RugCheck; EVM coins get it from GoPlus, which needs the numeric chain id.
Adding an EVM chain GoPlus supports is one entry here plus its id in
schemas.ChainId (a test keeps the two in step) and in frontend-next's chains.ts.
"""
import re
from dataclasses import dataclass
from typing import Literal

Family = Literal["solana", "evm"]

ADDRESS_PATTERNS: dict[Family, str] = {
    # base58: 32-44 characters, without 0, O, I, or l
    "solana": r"^[1-9A-HJ-NP-Za-km-z]{32,44}$",
    # 0x and 40 hex digits, in any letter case
    "evm": r"^0x[0-9a-fA-F]{40}$",
}


@dataclass(frozen=True)
class Chain:
    id: str
    name: str
    family: Family
    # GoPlus's chain id for EVM safety checks; None for Solana.
    goplus_id: str | None
    # A token's page on the chain's explorer.
    explorer_token_url: str


CHAINS: dict[str, Chain] = {
    chain.id: chain
    for chain in [
        Chain("solana", "Solana", "solana", None, "https://solscan.io/token/{address}"),
        Chain("ethereum", "Ethereum", "evm", "1", "https://etherscan.io/token/{address}"),
        Chain("bsc", "BNB Smart Chain", "evm", "56", "https://bscscan.com/token/{address}"),
        Chain("base", "Base", "evm", "8453", "https://basescan.org/token/{address}"),
        Chain("polygon", "Polygon", "evm", "137", "https://polygonscan.com/token/{address}"),
        Chain("arbitrum", "Arbitrum", "evm", "42161", "https://arbiscan.io/token/{address}"),
        Chain("robinhood", "Robinhood Chain", "evm", "4663", "https://robinhoodchain.blockscout.com/token/{address}"),
    ]
}

# Any address the analyzer accepts, for inputs that do not name a chain
# (wallet lists, the history filter).
ANY_ADDRESS = "^(" + "|".join(pattern.strip("^$") for pattern in ADDRESS_PATTERNS.values()) + ")$"


def is_valid_address(chain: Chain, address: str) -> bool:
    return re.fullmatch(ADDRESS_PATTERNS[chain.family], address) is not None


def normalize(address: str) -> str:
    """One spelling per address. EVM addresses are case-insensitive, so they are
    kept lower-case; base58 is case-sensitive and stays as it is."""
    return address.lower() if address.startswith("0x") else address


def family_of(address: str) -> Family:
    return "evm" if address.startswith("0x") else "solana"

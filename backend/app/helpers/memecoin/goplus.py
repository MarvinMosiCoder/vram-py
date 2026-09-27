"""GoPlus collector: contract safety for EVM tokens.

The token_security endpoint is free and needs no key. It answers HTTP 200 even
when it refuses: `code` is 1 for success, and 4029 when rate-limited. Flags come
as "1"/"0" strings; a missing or empty flag means GoPlus could not tell, which
happens for most flags when the contract's source is not verified.
"""
import asyncio

import httpx

from app import schemas
from app.helpers.memecoin.chains import Chain

TOKEN_SECURITY_URL = "https://api.gopluslabs.io/api/v1/token_security/{chain_id}"
TIMEOUT_SECONDS = 20
RATE_LIMITED_CODE = 4029
RETRY_WAIT_SECONDS = 5
# Addresses that hold burned tokens or LP tokens; nobody controls them.
BURN_ADDRESSES = {
    "0x0000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000dead",
}


class GoPlusError(Exception):
    """GoPlus refused the request or has no data for the token."""


async def fetch_token_security(client: httpx.AsyncClient, chain: Chain, address: str) -> dict:
    """GoPlus's record for one token. A rate limit is retried once."""
    url = TOKEN_SECURITY_URL.format(chain_id=chain.goplus_id)
    body = {}
    for attempt in range(2):
        response = await client.get(url, params={"contract_addresses": address}, timeout=TIMEOUT_SECONDS)
        response.raise_for_status()
        body = response.json()
        if body.get("code") != RATE_LIMITED_CODE:
            break
        if attempt == 0:
            await asyncio.sleep(RETRY_WAIT_SECONDS)
    if body.get("code") != 1:
        raise GoPlusError(f"code {body.get('code')}: {body.get('message')}")
    record = (body.get("result") or {}).get(address.lower())
    if not record:
        raise GoPlusError("no data for this token")
    return record


def flag(record: dict, key: str) -> bool | None:
    value = record.get(key)
    return None if value in (None, "") else value == "1"


def percent(value) -> float | None:
    """GoPlus shares and taxes are fractions as strings: "0.05" is 5%."""
    return None if value in (None, "") else float(value) * 100


def summarize_security(record: dict, address: str) -> schemas.SafetyData:
    """Keep what the rules use, with EVM addresses in lower case to match the
    blacklist."""
    owner = record.get("owner_address")
    # Per GoPlus: a missing owner is unknown, an empty one means no owner.
    renounced = None if owner is None else (owner == "" or owner.lower() in BURN_ADDRESSES)
    reclaimable = flag(record, "can_take_back_ownership")

    def owner_power(key: str) -> bool | None:
        """A power only the owner can use, which renounced ownership disarms
        unless the ownership can be taken back."""
        power = flag(record, key)
        if power is None or not power:
            return power
        return not (renounced and not reclaimable)

    honeypot = flag(record, "is_honeypot")
    if flag(record, "cannot_sell_all"):
        honeypot = True

    pairs = {(dex.get("pair") or "").lower() for dex in record.get("dex") or []}
    holders = [
        schemas.Holder(owner=h["address"].lower(), pct=percent(h.get("percent")) or 0, label=h.get("tag") or None)
        for h in record.get("holders") or []
        if h.get("address") and h["address"].lower() not in pairs | BURN_ADDRESSES
    ][:10]
    listed = bool(record.get("holders"))

    lp_holders = record.get("lp_holders") or []
    lp_locked = (
        sum(percent(h.get("percent")) or 0 for h in lp_holders if h.get("is_locked") == 1 or (h.get("address") or "").lower() in BURN_ADDRESSES)
        if lp_holders
        else None
    )

    taxes = [percent(record.get(key)) for key in ("buy_tax", "sell_tax", "transfer_tax")]
    known_taxes = [tax for tax in taxes if tax is not None]
    holder_count = record.get("holder_count")
    creator = record.get("creator_address")

    return schemas.SafetyData(
        mint=address.lower(),
        name=record.get("token_name"),
        symbol=record.get("token_symbol"),
        transfer_fee_pct=max(known_taxes) if known_taxes else None,
        lp_locked_pct=lp_locked,
        total_holders=int(holder_count) if holder_count not in (None, "") else None,
        top10_pct=sum(h.pct for h in holders) if listed else None,
        top_holders=holders,
        creator=creator.lower() if creator else None,
        creator_pct=percent(record.get("creator_percent")),
        honeypot=honeypot,
        buy_tax_pct=taxes[0],
        sell_tax_pct=taxes[1],
        open_source=flag(record, "is_open_source"),
        proxy=flag(record, "is_proxy"),
        owner=owner.lower() if owner else None,
        owner_renounced=renounced,
        owner_can_mint=owner_power("is_mintable"),
        owner_can_change_balances=owner_power("owner_change_balance"),
        hidden_owner=flag(record, "hidden_owner"),
        can_reclaim_ownership=reclaimable,
        transfers_pausable=owner_power("transfer_pausable"),
        can_blacklist=owner_power("is_blacklisted"),
        creator_made_honeypots=flag(record, "honeypot_with_same_creator"),
    )

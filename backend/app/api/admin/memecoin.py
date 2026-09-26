"""Memecoin analyzer endpoints: search for a coin, then analyze one mint.

Both call DexScreener and RugCheck live and store nothing. See
docs/vram/memecoin.md for how the report is built.
"""
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app import schemas
from app.core.auth import get_current_user
from app.helpers.memecoin import analyzer, dexscreener

router = APIRouter(prefix="/memecoin", tags=["memecoin"])

# Solana addresses are base58: 32-44 characters, without 0, O, I, or l.
SOLANA_ADDRESS = r"^[1-9A-HJ-NP-Za-km-z]{32,44}$"


@router.get("/search", response_model=list[schemas.MarketData])
async def search(
    q: str = Query(min_length=2, max_length=100),
    current_user=Depends(get_current_user),
):
    """Solana tokens matching a name or address, most traded first."""
    async with httpx.AsyncClient() as client:
        try:
            pairs = await dexscreener.search_pairs(client, q)
        except httpx.HTTPError as error:
            raise HTTPException(
                status_code=502,
                detail=f"DexScreener search failed: {analyzer.describe(error)}",
            ) from error

    return [token for token in dexscreener.group_tokens(pairs) if token.chain == "solana"]


@router.get("/analyze/{chain}/{address}", response_model=schemas.CoinReport)
async def analyze(
    chain: Literal["solana"],
    address: str = Path(pattern=SOLANA_ADDRESS),
    current_user=Depends(get_current_user),
):
    """Market data, safety data, and the rule verdict for one Solana mint.

    A source that fails is reported in ``errors`` rather than failing the request.
    """
    return await analyzer.analyze(address)

"""Gallery endpoints for browsing and managing generated images."""

from fastapi import APIRouter, HTTPException, Query

from backend.config import API_PREFIX
from backend.database import delete_entry, get_entries, search_entries

router = APIRouter(prefix=API_PREFIX, tags=["gallery"])


@router.get("/gallery")
async def list_gallery(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """Return a paginated list of gallery entries."""
    entries = await get_entries(limit=limit, offset=offset)
    return {"entries": entries, "limit": limit, "offset": offset}


@router.get("/gallery/search")
async def search_gallery(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """Search gallery entries by prompt text."""
    entries = await search_entries(query=q, limit=limit, offset=offset)
    return {"query": q, "entries": entries, "limit": limit, "offset": offset}


@router.delete("/gallery/{entry_id}")
async def delete_gallery_entry(entry_id: str) -> dict:
    """Delete a gallery entry by ID."""
    deleted = await delete_entry(entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Entry not found: {entry_id}")
    return {"status": "deleted", "id": entry_id}

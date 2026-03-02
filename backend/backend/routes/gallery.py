"""Gallery endpoints for browsing and managing generated images."""

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from backend.config import API_PREFIX, IMAGES_DIR
from backend.database import delete_entry, get_entries, get_entry_by_id, search_entries

logger = logging.getLogger(__name__)

router = APIRouter(prefix=API_PREFIX, tags=["gallery"])


# --------------------------------------------------------------------------- #
# GET /gallery
# --------------------------------------------------------------------------- #
@router.get("/gallery")
async def list_gallery(
    page: int = Query(default=1, ge=1, description="Page number (1-based)"),
    limit: int = Query(default=50, ge=1, le=200, description="Items per page"),
) -> dict:
    """Return a paginated list of gallery entries, newest first."""
    offset = (page - 1) * limit
    entries = await get_entries(limit=limit, offset=offset)

    # Enrich each entry with an image URL the frontend can use
    for entry in entries:
        if entry.get("image_path"):
            filename = Path(entry["image_path"]).name
            entry["image_url"] = f"/api/v1/images/{filename}"

    return {
        "entries": entries,
        "page": page,
        "limit": limit,
        "count": len(entries),
    }


# --------------------------------------------------------------------------- #
# GET /gallery/search
# --------------------------------------------------------------------------- #
@router.get("/gallery/search")
async def search_gallery(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict:
    """Search gallery entries by prompt text using full-text search."""
    offset = (page - 1) * limit
    entries = await search_entries(query=q, limit=limit, offset=offset)

    for entry in entries:
        if entry.get("image_path"):
            filename = Path(entry["image_path"]).name
            entry["image_url"] = f"/api/v1/images/{filename}"

    return {
        "query": q,
        "entries": entries,
        "page": page,
        "limit": limit,
        "count": len(entries),
    }


# --------------------------------------------------------------------------- #
# GET /gallery/{entry_id}
# --------------------------------------------------------------------------- #
@router.get("/gallery/{entry_id}")
async def get_gallery_entry(entry_id: str) -> dict:
    """Return a single gallery entry by its ID."""
    entry = await get_entry_by_id(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Entry not found: {entry_id}")

    if entry.get("image_path"):
        filename = Path(entry["image_path"]).name
        entry["image_url"] = f"/api/v1/images/{filename}"

    return entry


# --------------------------------------------------------------------------- #
# GET /gallery/{entry_id}/image
# --------------------------------------------------------------------------- #
@router.get("/gallery/{entry_id}/image")
async def get_gallery_image(entry_id: str) -> FileResponse:
    """Serve the generated image file for a gallery entry."""
    entry = await get_entry_by_id(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Entry not found: {entry_id}")

    image_path = entry.get("image_path")
    if not image_path:
        raise HTTPException(status_code=404, detail="No image associated with this entry")

    path = Path(image_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    return FileResponse(
        path=str(path),
        media_type="image/png",
        filename=path.name,
    )


# --------------------------------------------------------------------------- #
# DELETE /gallery/{entry_id}
# --------------------------------------------------------------------------- #
@router.delete("/gallery/{entry_id}")
async def delete_gallery_entry(entry_id: str) -> dict:
    """Delete a gallery entry and its associated image file."""
    # Fetch first so we can delete the image file
    entry = await get_entry_by_id(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Entry not found: {entry_id}")

    # Delete the image file from disk
    image_path = entry.get("image_path")
    if image_path:
        path = Path(image_path)
        if path.is_file():
            try:
                path.unlink()
                logger.info("Deleted image file: %s", path)
            except OSError:
                logger.warning("Failed to delete image file: %s", path, exc_info=True)

    # Delete the database record (triggers FTS cleanup via triggers)
    deleted = await delete_entry(entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Entry not found: {entry_id}")

    return {"status": "deleted", "id": entry_id}


# --------------------------------------------------------------------------- #
# GET /images/{filename}  -- Static image serving
# --------------------------------------------------------------------------- #
@router.get("/images/{filename}")
async def serve_image(filename: str) -> FileResponse:
    """Serve a generated image by filename from the images directory."""
    # Sanitise: prevent directory traversal
    safe_name = Path(filename).name
    file_path = IMAGES_DIR / safe_name

    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")

    # Determine media type from extension
    suffix = file_path.suffix.lower()
    media_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }
    media_type = media_types.get(suffix, "application/octet-stream")

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=safe_name,
    )

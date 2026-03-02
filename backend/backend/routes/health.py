"""Health check endpoint."""

from fastapi import APIRouter

from backend.config import API_PREFIX

router = APIRouter(prefix=API_PREFIX, tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """Return a simple health status."""
    return {"status": "ok"}

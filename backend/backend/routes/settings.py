"""Settings endpoints for app configuration."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from backend.config import API_PREFIX
from backend.settings import get_settings, update_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix=API_PREFIX, tags=["settings"])


class SettingsUpdate(BaseModel):
    hf_token: str | None = None


# --------------------------------------------------------------------------- #
# GET /settings
# --------------------------------------------------------------------------- #
@router.get("/settings")
async def read_settings() -> dict:
    """Return the current application settings."""
    settings = get_settings()
    # Mask the token for security — only return whether it's set + last 4 chars
    hf_token = settings.get("hf_token", "")
    if hf_token and len(hf_token) > 4:
        settings["hf_token_preview"] = f"...{hf_token[-4:]}"
    else:
        settings["hf_token_preview"] = ""
    settings["hf_token_set"] = bool(hf_token)
    # Don't send the full token back
    del settings["hf_token"]
    return settings


# --------------------------------------------------------------------------- #
# PUT /settings
# --------------------------------------------------------------------------- #
@router.put("/settings")
async def write_settings(body: SettingsUpdate) -> dict:
    """Update application settings."""
    updates = body.model_dump(exclude_none=True)
    updated = update_settings(updates)
    # Return same masked format as GET
    hf_token = updated.get("hf_token", "")
    if hf_token and len(hf_token) > 4:
        updated["hf_token_preview"] = f"...{hf_token[-4:]}"
    else:
        updated["hf_token_preview"] = ""
    updated["hf_token_set"] = bool(hf_token)
    del updated["hf_token"]
    return updated

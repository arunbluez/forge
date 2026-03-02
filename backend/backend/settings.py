"""Settings manager for persistent app configuration."""

import json
import logging
import os
from pathlib import Path
from typing import Any

from backend.config import DATA_DIR

logger = logging.getLogger(__name__)

SETTINGS_PATH = DATA_DIR / "settings.json"

_DEFAULTS: dict[str, Any] = {
    "hf_token": "",
}


def _read_settings() -> dict[str, Any]:
    """Read settings from disk, returning defaults for missing keys."""
    data: dict[str, Any] = {}
    if SETTINGS_PATH.is_file():
        try:
            data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        except Exception:
            logger.warning("Failed to read settings file, using defaults", exc_info=True)
    return {**_DEFAULTS, **data}


def _write_settings(settings: dict[str, Any]) -> None:
    """Persist settings to disk."""
    SETTINGS_PATH.write_text(
        json.dumps(settings, indent=2) + "\n",
        encoding="utf-8",
    )


def get_settings() -> dict[str, Any]:
    """Return the current settings dict."""
    return _read_settings()


def update_settings(updates: dict[str, Any]) -> dict[str, Any]:
    """Merge *updates* into the current settings and persist."""
    current = _read_settings()
    current.update(updates)
    _write_settings(current)
    # Apply side-effects (e.g. set env vars)
    _apply_settings(current)
    return current


def _apply_settings(settings: dict[str, Any]) -> None:
    """Apply runtime side-effects based on current settings."""
    hf_token = settings.get("hf_token", "")
    if hf_token:
        os.environ["HF_TOKEN"] = hf_token
    elif "HF_TOKEN" in os.environ and not hf_token:
        # Only remove if we previously set it (user cleared the token)
        os.environ.pop("HF_TOKEN", None)


def apply_saved_settings() -> None:
    """Load settings from disk and apply them. Called at startup."""
    settings = _read_settings()
    _apply_settings(settings)
    token_set = bool(settings.get("hf_token"))
    logger.info("Settings loaded (HF token: %s)", "set" if token_set else "not set")

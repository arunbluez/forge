"""Model manager for downloading, loading, and unloading AI models."""

import logging
from typing import Callable, Optional

from backend.config import MODELS_REGISTRY

logger = logging.getLogger(__name__)


class ModelManager:
    """Manages the lifecycle of AI models: download, load, unload, delete."""

    def __init__(self) -> None:
        self._loaded_model_id: Optional[str] = None
        self._pipeline = None

    async def load_model(self, model_id: str) -> bool:
        """Load a model into memory. Returns True on success.

        Stub: will be implemented with actual pipeline loading.
        """
        logger.info("load_model called for %s (stub)", model_id)
        self._loaded_model_id = model_id
        return True

    async def unload_model(self) -> None:
        """Unload the currently loaded model and free memory.

        Stub: will be implemented with actual cleanup.
        """
        logger.info("unload_model called (stub)")
        self._loaded_model_id = None
        self._pipeline = None

    def get_loaded_model_id(self) -> Optional[str]:
        """Return the ID of the currently loaded model, or None."""
        return self._loaded_model_id

    async def get_download_status(self, model_id: str) -> dict:
        """Return the download status for a specific model.

        Stub: returns a not-downloaded status for all models.
        """
        registry_entry = next(
            (m for m in MODELS_REGISTRY if m["id"] == model_id), None
        )
        if registry_entry is None:
            return {"model_id": model_id, "error": "unknown_model"}

        return {
            "model_id": model_id,
            "downloaded": False,
            "download_progress": 0.0,
            "disk_usage_bytes": 0,
        }

    async def download_model(
        self,
        model_id: str,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> None:
        """Download a model from the Hugging Face Hub.

        Stub: will be implemented with actual download logic.
        """
        logger.info("download_model called for %s (stub)", model_id)

    async def delete_model(self, model_id: str) -> bool:
        """Delete a downloaded model from disk. Returns True on success.

        Stub: will be implemented with actual file deletion.
        """
        logger.info("delete_model called for %s (stub)", model_id)
        return True

    async def get_all_models_status(self) -> list[dict]:
        """Return all models from the registry with their current status."""
        result = []
        for model in MODELS_REGISTRY:
            status = await self.get_download_status(model["id"])
            entry = {**model, **status, "loaded": model["id"] == self._loaded_model_id}
            result.append(entry)
        return result

    def get_disk_usage(self, model_id: str) -> int:
        """Return disk usage in bytes for a specific model. (Stub)"""
        return 0

    def get_total_disk_usage(self) -> int:
        """Return total disk usage in bytes across all downloaded models. (Stub)"""
        return 0

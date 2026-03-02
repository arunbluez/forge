"""Model management endpoints."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException, Request

from backend.config import API_PREFIX, MODELS_REGISTRY

logger = logging.getLogger(__name__)

router = APIRouter(prefix=API_PREFIX, tags=["models"])

# Track active download tasks so we can report progress / cancel them.
_download_tasks: dict[str, asyncio.Task] = {}


def _get_model_manager(request: Request):
    """Retrieve the ModelManager singleton from app state."""
    return request.app.state.model_manager


def _validate_model_id(model_id: str) -> dict:
    """Validate that model_id exists in the registry and return the entry."""
    entry = next((m for m in MODELS_REGISTRY if m["id"] == model_id), None)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Unknown model: {model_id}")
    return entry


# --------------------------------------------------------------------------- #
# GET /models
# --------------------------------------------------------------------------- #
@router.get("/models")
async def list_models(request: Request) -> list[dict]:
    """List all models from the registry with their download/load status."""
    model_manager = _get_model_manager(request)
    return await model_manager.get_all_models_status()


# --------------------------------------------------------------------------- #
# POST /models/{model_id}/download
# --------------------------------------------------------------------------- #
@router.post("/models/{model_id}/download")
async def download_model(model_id: str, request: Request) -> dict:
    """Start downloading a model in the background.

    Returns immediately with ``{"status": "downloading"}``.  The progress
    can be polled via GET /models/{model_id}/download-status.
    """
    _validate_model_id(model_id)
    model_manager = _get_model_manager(request)

    # Prevent duplicate downloads
    existing_task = _download_tasks.get(model_id)
    if existing_task is not None and not existing_task.done():
        return {"status": "already_downloading", "model_id": model_id}

    async def _do_download() -> None:
        try:
            await model_manager.download_model(model_id)
            logger.info("Download complete for model %s", model_id)
        except Exception:
            logger.exception("Download failed for model %s", model_id)
        finally:
            # Clean up reference once finished
            _download_tasks.pop(model_id, None)

    task = asyncio.create_task(_do_download())
    _download_tasks[model_id] = task

    return {"status": "downloading", "model_id": model_id}


# --------------------------------------------------------------------------- #
# GET /models/{model_id}/download-status
# --------------------------------------------------------------------------- #
@router.get("/models/{model_id}/download-status")
async def download_status(model_id: str, request: Request) -> dict:
    """Return the current download progress for a model."""
    _validate_model_id(model_id)
    model_manager = _get_model_manager(request)
    status = await model_manager.get_download_status(model_id)

    # Augment with whether an active download task is running
    task = _download_tasks.get(model_id)
    if task is not None and not task.done():
        status["active_download"] = True
    else:
        status["active_download"] = False

    return status


# --------------------------------------------------------------------------- #
# POST /models/{model_id}/load
# --------------------------------------------------------------------------- #
@router.post("/models/{model_id}/load")
async def load_model(model_id: str, request: Request) -> dict:
    """Load a model into memory.

    This awaits the (potentially long-running) load operation so the caller
    knows when the model is ready to use.
    """
    _validate_model_id(model_id)
    model_manager = _get_model_manager(request)

    success = await model_manager.load_model(model_id)
    if not success:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load model: {model_id}",
        )

    return {"status": "loaded", "model_id": model_id}


# --------------------------------------------------------------------------- #
# POST /models/{model_id}/unload
# --------------------------------------------------------------------------- #
@router.post("/models/{model_id}/unload")
async def unload_model(model_id: str, request: Request) -> dict:
    """Unload the currently loaded model to free memory."""
    _validate_model_id(model_id)
    model_manager = _get_model_manager(request)

    if model_manager.get_loaded_model_id() != model_id:
        raise HTTPException(
            status_code=400,
            detail=f"Model {model_id} is not currently loaded",
        )

    await model_manager.unload_model()
    return {"status": "unloaded", "model_id": model_id}


# --------------------------------------------------------------------------- #
# DELETE /models/{model_id}
# --------------------------------------------------------------------------- #
@router.delete("/models/{model_id}")
async def delete_model(model_id: str, request: Request) -> dict:
    """Delete a downloaded model from disk."""
    _validate_model_id(model_id)
    model_manager = _get_model_manager(request)

    # Unload first if this model is currently loaded
    if model_manager.get_loaded_model_id() == model_id:
        await model_manager.unload_model()

    success = await model_manager.delete_model(model_id)
    if not success:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete model: {model_id}",
        )

    return {"status": "deleted", "model_id": model_id}

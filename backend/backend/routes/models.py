"""Model management endpoints."""

from fastapi import APIRouter, HTTPException

from backend.config import API_PREFIX, MODELS_REGISTRY
from backend.models.manager import ModelManager

router = APIRouter(prefix=API_PREFIX, tags=["models"])

model_manager = ModelManager()


@router.get("/models")
async def list_models() -> list[dict]:
    """List all models from the registry with their download status."""
    return await model_manager.get_all_models_status()


@router.post("/models/{model_id}/download")
async def download_model(model_id: str) -> dict:
    """Start downloading a model. (Stub)"""
    # Validate model_id
    if not any(m["id"] == model_id for m in MODELS_REGISTRY):
        raise HTTPException(status_code=404, detail=f"Unknown model: {model_id}")
    return {"status": "download_started", "model_id": model_id}


@router.post("/models/{model_id}/load")
async def load_model(model_id: str) -> dict:
    """Load a model into memory. (Stub)"""
    if not any(m["id"] == model_id for m in MODELS_REGISTRY):
        raise HTTPException(status_code=404, detail=f"Unknown model: {model_id}")
    return {"status": "load_started", "model_id": model_id}


@router.delete("/models/{model_id}")
async def delete_model(model_id: str) -> dict:
    """Delete a downloaded model from disk. (Stub)"""
    if not any(m["id"] == model_id for m in MODELS_REGISTRY):
        raise HTTPException(status_code=404, detail=f"Unknown model: {model_id}")
    return {"status": "deleted", "model_id": model_id}

"""Image generation endpoints including WebSocket streaming."""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.config import API_PREFIX
from backend.models.inference import cancel_generation, generate

logger = logging.getLogger(__name__)

router = APIRouter(prefix=API_PREFIX, tags=["generate"])


# --------------------------------------------------------------------------- #
# WebSocket  /ws/generate
# --------------------------------------------------------------------------- #
@router.websocket("/ws/generate")
async def ws_generate(websocket: WebSocket) -> None:
    """WebSocket endpoint for image generation with progress streaming.

    Protocol:
    1. Client sends a JSON message with generation parameters.
    2. Server streams frames from the ``generate()`` async generator:
       - ``{"type": "preview", ...}``  – intermediate denoising previews
       - ``{"type": "complete", ...}`` – final result with image + gallery id
       - ``{"type": "error", ...}``    – generation failure
       - ``{"type": "cancelled"}``     – user-initiated cancellation
    """
    await websocket.accept()
    try:
        # ----- Receive generation parameters --------------------------------
        data = await websocket.receive_json()

        prompt: str = data.get("prompt", "")
        negative_prompt = data.get("negative_prompt") or None
        model_id = data.get("model_id")
        width: int = data.get("width", 1024)
        height: int = data.get("height", 1024)
        steps: int = data.get("steps", 20)
        seed: int = data.get("seed", -1)
        guidance_scale: float = data.get("guidance_scale", 3.5)
        source_image = data.get("source_image")  # base64 or None
        strength: float = data.get("strength", 0.75)

        if not prompt:
            await websocket.send_json({"type": "error", "message": "prompt is required"})
            await websocket.close()
            return

        # ----- Resolve model manager ----------------------------------------
        model_manager = websocket.app.state.model_manager
        loaded_model_id = model_manager.get_loaded_model_id()

        # If a model_id is specified and differs from the loaded one, load it
        if model_id and model_id != loaded_model_id:
            await websocket.send_json({
                "type": "status",
                "message": f"Loading model {model_id}...",
            })
            success = await model_manager.load_model(model_id)
            if not success:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Failed to load model: {model_id}",
                })
                await websocket.close()
                return

        if model_manager.get_loaded_model_id() is None:
            await websocket.send_json({
                "type": "error",
                "message": "No model is loaded. Please load a model first.",
            })
            await websocket.close()
            return

        await websocket.send_json({"type": "status", "message": "Generating..."})

        # Build source_images list from the single source_image field
        source_images = [source_image] if source_image else None

        # ----- Stream frames from the async generator -----------------------
        async for frame in generate(
            prompt=prompt,
            negative_prompt=negative_prompt,
            model_id=model_id,
            width=width,
            height=height,
            steps=steps,
            guidance_scale=guidance_scale,
            seed=seed,
            source_images=source_images,
            strength=strength,
            model_manager=model_manager,
        ):
            await websocket.send_json(frame)

    except WebSocketDisconnect:
        logger.info("Client disconnected during generation")
        cancel_generation()
    except Exception as e:
        logger.error("Generation error: %s", e, exc_info=True)
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


# --------------------------------------------------------------------------- #
# POST /generate/cancel
# --------------------------------------------------------------------------- #
@router.post("/generate/cancel")
async def cancel_generation_endpoint() -> dict:
    """Cancel the currently running image generation."""
    cancel_generation()
    return {"status": "cancelled"}

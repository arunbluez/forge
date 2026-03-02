"""Image generation endpoints including WebSocket streaming."""

import asyncio
import logging
import time
import uuid
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.config import API_PREFIX, IMAGES_DIR
from backend.database import create_entry
from backend.models.inference import cancel_generation, generate, reset_cancel_flag

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
    2. Server sends progress updates: ``{"type": "progress", "step": N, "total_steps": M, "elapsed": S}``
    3. Server sends the final result:  ``{"type": "complete", "entry": {...}}``
       or an error:                     ``{"type": "error", "message": "..."}``
    """
    await websocket.accept()
    try:
        # ----- Receive generation parameters --------------------------------
        data = await websocket.receive_json()

        prompt: str = data.get("prompt", "")
        negative_prompt: Optional[str] = data.get("negative_prompt") or None
        model_id: Optional[str] = data.get("model_id")
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

        # ----- Resolve model manager and pipeline ---------------------------
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
            loaded_model_id = model_id

        if loaded_model_id is None:
            await websocket.send_json({
                "type": "error",
                "message": "No model is loaded. Please load a model first.",
            })
            await websocket.close()
            return

        # Resolve actual seed
        if seed < 0:
            import random
            seed = random.randint(0, 2**32 - 1)

        # ----- Progress callback (runs from the inference thread) -----------
        loop = asyncio.get_event_loop()

        def _progress_callback(step: int, total_steps: int, elapsed: float) -> None:
            """Send a progress update over the WebSocket (thread-safe)."""
            msg = {
                "type": "progress",
                "step": step,
                "total_steps": total_steps,
                "elapsed": round(elapsed, 2),
            }
            asyncio.run_coroutine_threadsafe(
                websocket.send_json(msg), loop,
            )

        # ----- Run generation -----------------------------------------------
        await websocket.send_json({"type": "status", "message": "Generating..."})

        reset_cancel_flag()
        start_time = time.time()

        pipeline = model_manager._pipeline  # noqa: SLF001 (internal access)

        image = await generate(
            pipeline=pipeline,
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            steps=steps,
            guidance_scale=guidance_scale,
            seed=seed,
            source_image=source_image,
            strength=strength,
            progress_callback=_progress_callback,
        )

        generation_time_ms = int((time.time() - start_time) * 1000)

        if image is None:
            # Generation was cancelled or produced no output
            await websocket.send_json({
                "type": "cancelled",
                "message": "Generation was cancelled.",
            })
            await websocket.close()
            return

        # ----- Save image to disk -------------------------------------------
        image_filename = f"{uuid.uuid4().hex}.png"
        image_path = IMAGES_DIR / image_filename
        image.save(str(image_path), format="PNG")

        # ----- Save gallery entry -------------------------------------------
        entry = await create_entry(
            prompt=prompt,
            negative_prompt=negative_prompt,
            model_id=loaded_model_id,
            seed=seed,
            width=width,
            height=height,
            steps=steps,
            guidance_scale=guidance_scale,
            image_path=str(image_path),
            generation_time_ms=generation_time_ms,
            source_images=None,
        )

        # Add image_url for convenience
        entry["image_url"] = f"/api/v1/images/{image_filename}"

        await websocket.send_json({"type": "complete", "entry": entry})

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

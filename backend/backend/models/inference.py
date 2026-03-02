"""Inference engine for running image generation pipelines.

Handles text-to-image and image-to-image generation with streaming preview
via step callbacks.  The main entry point, ``generate()``, is an async
generator that yields preview frames during denoising and a final result
dict once the image has been saved and registered in the gallery database.
"""

import asyncio
import base64
import gc
import io
import json
import logging
import random
import time
import uuid
from typing import Any, AsyncGenerator, List, Optional

from backend.config import IMAGES_DIR, MODELS_REGISTRY
from backend import database

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level cancellation state
# ---------------------------------------------------------------------------
_cancel_requested: bool = False


def cancel_generation() -> None:
    """Request cancellation of the currently running generation.

    Sets a module-level flag that the step callback inspects on every
    denoising step.  When the flag is ``True`` the callback sets
    ``pipe._interrupt = True`` which causes diffusers pipelines to stop
    early and return whatever latents are available.
    """
    global _cancel_requested
    _cancel_requested = True
    logger.info("Generation cancellation requested.")


def reset_cancel_flag() -> None:
    """Reset the cancellation flag before starting a new generation."""
    global _cancel_requested
    _cancel_requested = False


# ---------------------------------------------------------------------------
# Image-to-image helpers
# ---------------------------------------------------------------------------

def decode_base64_image(base64_str: str) -> "PIL.Image.Image":
    """Decode a base64-encoded image string into a PIL Image (RGB).

    Accepts both raw base64 and ``data:`` URI prefixed strings.
    """
    from PIL import Image

    # Strip optional data-uri prefix (e.g. "data:image/png;base64,...")
    if "," in base64_str and base64_str.startswith("data:"):
        base64_str = base64_str.split(",", 1)[1]

    raw = base64.b64decode(base64_str)
    img = Image.open(io.BytesIO(raw))
    return img.convert("RGB")


def _snap_to_multiple(value: int, multiple: int = 64) -> int:
    """Round *value* to the nearest multiple (default 64)."""
    return max(multiple, round(value / multiple) * multiple)


def resize_for_pipeline(
    image: "PIL.Image.Image",
    target_width: int,
    target_height: int,
) -> "PIL.Image.Image":
    """Resize *image* to fit within *target_width* x *target_height*.

    The aspect ratio of the source image is preserved.  The resulting
    dimensions are snapped to the nearest 64-pixel boundary (required by
    most latent-diffusion pipelines).  Resampling uses LANCZOS for quality.
    """
    from PIL import Image

    src_w, src_h = image.size
    src_aspect = src_w / src_h
    target_aspect = target_width / target_height

    if src_aspect > target_aspect:
        # Source is wider – fit to target width
        new_w = target_width
        new_h = round(target_width / src_aspect)
    else:
        # Source is taller – fit to target height
        new_h = target_height
        new_w = round(target_height * src_aspect)

    new_w = _snap_to_multiple(new_w)
    new_h = _snap_to_multiple(new_h)

    return image.resize((new_w, new_h), Image.LANCZOS)


def calculate_dimensions_from_image(
    image: "PIL.Image.Image",
    resolution_preset: int = 1024,
) -> tuple[int, int]:
    """Calculate output dimensions from a source image.

    The longest side is matched to *resolution_preset* (default 1024) while
    preserving the aspect ratio, and both dimensions are snapped to 64.
    """
    src_w, src_h = image.size
    if src_w >= src_h:
        scale = resolution_preset / src_w
    else:
        scale = resolution_preset / src_h

    new_w = _snap_to_multiple(round(src_w * scale))
    new_h = _snap_to_multiple(round(src_h * scale))
    return new_w, new_h


# ---------------------------------------------------------------------------
# Preview encoding helper
# ---------------------------------------------------------------------------

def _encode_preview_jpeg(image_tensor: "torch.Tensor") -> str:
    """Convert a float [0, 1] image tensor (H, W, C) to a base64 JPEG string.

    The JPEG is encoded at quality 50 for a compact preview suitable for
    streaming over a WebSocket.
    """
    from PIL import Image
    import numpy as np

    arr = (image_tensor.clamp(0, 1) * 255).byte().cpu().numpy()
    pil_image = Image.fromarray(arr)
    buffer = io.BytesIO()
    pil_image.save(buffer, format="JPEG", quality=50)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _encode_final_png(pil_image: "PIL.Image.Image") -> str:
    """Encode a PIL Image as a base64 PNG string."""
    buffer = io.BytesIO()
    pil_image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


# ---------------------------------------------------------------------------
# Core generation engine
# ---------------------------------------------------------------------------

class _GenerationCancelled(Exception):
    """Raised internally when the user cancels a running generation."""


# How often we decode latents for a preview frame.  Decoding every single
# step would unacceptably slow down generation, so we do it every N steps.
_PREVIEW_EVERY_N_STEPS: int = 3


async def generate(
    prompt: str,
    negative_prompt: Optional[str] = None,
    model_id: Optional[str] = None,
    width: int = 1024,
    height: int = 1024,
    steps: int = 20,
    guidance_scale: float = 3.5,
    seed: int = -1,
    source_images: Optional[List[str]] = None,
    strength: float = 0.75,
    model_manager: Any = None,
) -> AsyncGenerator[dict, None]:
    """Run image generation and stream preview frames as an async generator.

    Yields
    ------
    Preview frames (during denoising)::

        {
            "type": "preview",
            "step": <int>,
            "total_steps": <int>,
            "image_base64": "<base64 JPEG>"
        }

    Final result (after pipeline completes)::

        {
            "type": "complete",
            "image_base64": "<base64 PNG>",
            "seed": <int>,
            "generation_time_ms": <int>,
            "gallery_id": "<uuid>"
        }

    Error::

        {
            "type": "error",
            "message": "<description>"
        }

    Cancelled::

        {
            "type": "cancelled"
        }
    """
    import torch

    reset_cancel_flag()
    start_time = time.time()

    # ------------------------------------------------------------------
    # 1. Validate that a model is loaded
    # ------------------------------------------------------------------
    if model_manager is None:
        yield {"type": "error", "message": "No model manager provided."}
        return

    pipeline = model_manager._pipeline
    if pipeline is None:
        yield {
            "type": "error",
            "message": "No model is currently loaded. Please load a model first.",
        }
        return

    loaded_model_id = model_manager.get_loaded_model_id()
    effective_model_id = model_id or loaded_model_id
    if effective_model_id is None:
        yield {"type": "error", "message": "Unable to determine the active model ID."}
        return

    # Look up registry entry for capability checks
    registry_entry = next(
        (m for m in MODELS_REGISTRY if m["id"] == effective_model_id), None
    )

    # ------------------------------------------------------------------
    # 2. Handle seed
    # ------------------------------------------------------------------
    if seed is None or seed < 0:
        seed = random.randint(0, 2**32 - 1)
    logger.info("Using seed %d", seed)

    # Determine device from pipeline
    try:
        device = pipeline.device
    except Exception:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    generator = torch.Generator(device="cpu").manual_seed(seed)

    # ------------------------------------------------------------------
    # 3. Prepare source images for img2img (if any)
    # ------------------------------------------------------------------
    is_img2img = bool(source_images)
    source_pil: Optional["PIL.Image.Image"] = None

    if is_img2img:
        if registry_entry and not registry_entry.get("supports_img2img", False):
            yield {
                "type": "error",
                "message": (
                    f"Model '{effective_model_id}' does not support image-to-image."
                ),
            }
            return

        try:
            # Use the first source image
            source_pil = decode_base64_image(source_images[0])
            source_pil = resize_for_pipeline(source_pil, width, height)
            # Recalculate actual dimensions from the resized image
            width, height = source_pil.size
            logger.info(
                "img2img source decoded and resized to %dx%d", width, height
            )
        except Exception as exc:
            logger.exception("Failed to decode source image")
            yield {
                "type": "error",
                "message": f"Failed to decode source image: {exc}",
            }
            return

    # ------------------------------------------------------------------
    # 4. Set up preview callback state
    # ------------------------------------------------------------------
    # We use a thread-safe asyncio.Queue to shuttle preview frames from the
    # synchronous pipeline callback (running in a worker thread) back to
    # this async generator (running on the event loop).
    loop = asyncio.get_event_loop()
    preview_queue: asyncio.Queue[Optional[dict]] = asyncio.Queue()

    def _step_callback(
        pipe: Any,
        step_index: int,
        timestep: Any,
        callback_kwargs: dict,
    ) -> dict:
        """Diffusers ``callback_on_step_end`` hook.

        Checks the cancellation flag, optionally decodes latents for a
        preview frame, and returns *callback_kwargs* unchanged so the
        pipeline continues normally.
        """
        # -- Cancellation ---------------------------------------------------
        if _cancel_requested:
            logger.info("Cancellation flag detected at step %d", step_index)
            pipe._interrupt = True
            return callback_kwargs

        # -- Preview frame --------------------------------------------------
        if step_index % _PREVIEW_EVERY_N_STEPS == 0 or step_index == steps - 1:
            try:
                latents = callback_kwargs.get("latents")
                if latents is not None:
                    with torch.no_grad():
                        decoded = pipe.vae.decode(
                            latents / pipe.vae.config.scaling_factor
                        ).sample
                    # decoded shape: (B, C, H, W) -> take first sample
                    image = decoded[0]  # (C, H, W)
                    image = (image / 2 + 0.5).clamp(0, 1)
                    image = image.permute(1, 2, 0)  # -> (H, W, C)

                    b64_jpeg = _encode_preview_jpeg(image)
                    frame = {
                        "type": "preview",
                        "step": step_index + 1,
                        "total_steps": steps,
                        "image_base64": b64_jpeg,
                    }
                    loop.call_soon_threadsafe(preview_queue.put_nowait, frame)
            except Exception:
                # Preview failures must never abort generation
                logger.debug(
                    "Preview decode failed at step %d", step_index, exc_info=True
                )

        return callback_kwargs

    # ------------------------------------------------------------------
    # 5. Run the pipeline in a worker thread
    # ------------------------------------------------------------------

    pipeline_result_holder: dict[str, Any] = {}

    def _run_pipeline() -> None:
        """Execute the diffusers pipeline synchronously."""
        try:
            with torch.inference_mode():
                common_kwargs: dict[str, Any] = {
                    "prompt": prompt,
                    "negative_prompt": negative_prompt or "",
                    "num_inference_steps": steps,
                    "guidance_scale": guidance_scale,
                    "generator": generator,
                    "width": width,
                    "height": height,
                    "callback_on_step_end": _step_callback,
                }

                if is_img2img and source_pil is not None:
                    common_kwargs["image"] = source_pil
                    common_kwargs["strength"] = strength

                result = pipeline(**common_kwargs)

            pipeline_result_holder["result"] = result
        except torch.cuda.OutOfMemoryError:
            logger.error("CUDA out of memory during generation")
            pipeline_result_holder["error"] = (
                "Out of GPU memory. Try a smaller resolution or fewer steps, "
                "or unload and reload the model."
            )
        except Exception as exc:
            logger.exception("Pipeline execution failed")
            pipeline_result_holder["error"] = str(exc)
        finally:
            # Signal the preview consumer that no more frames are coming
            loop.call_soon_threadsafe(preview_queue.put_nowait, None)

    # Launch the pipeline in a thread
    pipeline_task = asyncio.ensure_future(asyncio.to_thread(_run_pipeline))

    # ------------------------------------------------------------------
    # 6. Yield preview frames as they arrive
    # ------------------------------------------------------------------
    while True:
        frame = await preview_queue.get()
        if frame is None:
            # Pipeline has finished (or errored)
            break
        yield frame

    # Await the thread to ensure it is fully complete
    await pipeline_task

    # ------------------------------------------------------------------
    # 7. Handle cancellation
    # ------------------------------------------------------------------
    if _cancel_requested:
        logger.info("Generation was cancelled.")
        _cleanup(device)
        yield {"type": "cancelled"}
        return

    # ------------------------------------------------------------------
    # 8. Handle pipeline errors
    # ------------------------------------------------------------------
    if "error" in pipeline_result_holder:
        _cleanup(device)
        yield {"type": "error", "message": pipeline_result_holder["error"]}
        return

    # ------------------------------------------------------------------
    # 9. Process final image
    # ------------------------------------------------------------------
    try:
        from PIL import Image as PILImage

        result = pipeline_result_holder["result"]
        # diffusers pipelines typically return .images as a list of PIL images
        if hasattr(result, "images") and result.images:
            final_image: PILImage.Image = result.images[0]
        else:
            _cleanup(device)
            yield {"type": "error", "message": "Pipeline returned no images."}
            return

        # Ensure RGB
        if final_image.mode != "RGB":
            final_image = final_image.convert("RGB")

        # Save to disk as PNG
        filename = f"{uuid.uuid4()}.png"
        image_path = IMAGES_DIR / filename
        final_image.save(str(image_path), format="PNG")
        logger.info("Saved generated image to %s", image_path)

        # Calculate elapsed time
        elapsed_ms = int((time.time() - start_time) * 1000)

        # Create gallery entry in database
        source_images_json: Optional[str] = None
        if source_images:
            # Store a compact representation (just count + truncated hashes)
            source_images_json = json.dumps(
                [s[:40] + "..." for s in source_images]
            )

        gallery_entry = await database.create_entry(
            prompt=prompt,
            model_id=effective_model_id,
            seed=seed,
            width=final_image.size[0],
            height=final_image.size[1],
            steps=steps,
            guidance_scale=guidance_scale,
            image_path=str(image_path),
            generation_time_ms=elapsed_ms,
            negative_prompt=negative_prompt,
            source_images=source_images_json,
        )

        entry_id = gallery_entry.get("id", "")

        # Encode final image as base64 PNG
        final_b64 = _encode_final_png(final_image)

        yield {
            "type": "complete",
            "image_base64": final_b64,
            "seed": seed,
            "generation_time_ms": elapsed_ms,
            "gallery_id": entry_id,
        }

    except Exception as exc:
        logger.exception("Failed to process final image")
        yield {"type": "error", "message": f"Post-processing failed: {exc}"}
    finally:
        _cleanup(device)


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

def _cleanup(device: Any = None) -> None:
    """Free memory after generation completes or fails."""
    import torch

    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        logger.debug("CUDA cache cleared")
    if hasattr(torch, "mps") and hasattr(torch.mps, "empty_cache"):
        try:
            torch.mps.empty_cache()
            logger.debug("MPS cache cleared")
        except Exception:
            pass

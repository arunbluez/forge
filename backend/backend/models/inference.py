"""Inference engine for running image generation pipelines."""

import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# Flag used to signal cancellation of the current generation
_cancel_requested: bool = False


async def generate(
    pipeline: Any,
    prompt: str,
    negative_prompt: Optional[str] = None,
    width: int = 1024,
    height: int = 1024,
    steps: int = 20,
    guidance_scale: float = 3.5,
    seed: Optional[int] = None,
    source_image: Optional[Any] = None,
    strength: float = 0.75,
    progress_callback: Optional[Callable[[int, int, float], None]] = None,
) -> Optional[Any]:
    """Run image generation using the provided pipeline.

    Args:
        pipeline: The loaded diffusion pipeline.
        prompt: The text prompt for generation.
        negative_prompt: Optional negative prompt.
        width: Output image width in pixels.
        height: Output image height in pixels.
        steps: Number of inference steps.
        guidance_scale: Classifier-free guidance scale.
        seed: Random seed for reproducibility.
        source_image: Optional source image for img2img.
        strength: Denoising strength for img2img (0.0 to 1.0).
        progress_callback: Optional callback(step, total_steps, elapsed_seconds).

    Returns:
        Generated PIL Image, or None if cancelled.

    Stub: will be implemented with actual pipeline inference.
    """
    logger.info("generate() called (stub) - prompt: %s", prompt[:80])
    return None


def cancel_generation() -> None:
    """Request cancellation of the currently running generation.

    Stub: will be wired into the pipeline's callback mechanism.
    """
    global _cancel_requested
    _cancel_requested = True
    logger.info("Generation cancellation requested.")


def reset_cancel_flag() -> None:
    """Reset the cancellation flag before starting a new generation."""
    global _cancel_requested
    _cancel_requested = False

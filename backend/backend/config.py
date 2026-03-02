"""Forge backend configuration."""

import os
import platform
from pathlib import Path

APP_NAME = "Forge"
API_VERSION = "v1"
API_PREFIX = "/api/v1"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8188


def _get_data_dir() -> Path:
    """Determine the platform-appropriate data directory for Forge."""
    system = platform.system()
    if system == "Darwin":
        data_dir = Path.home() / "Library" / "Application Support" / APP_NAME
    elif system == "Windows":
        app_data = Path.home() / "AppData" / "Roaming"
        data_dir = app_data / APP_NAME
    else:
        # Linux / other Unix - use XDG_DATA_HOME or fallback
        xdg_data = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
        data_dir = xdg_data / APP_NAME.lower()
    return data_dir


DATA_DIR = _get_data_dir()
IMAGES_DIR = DATA_DIR / "images"
DB_PATH = DATA_DIR / "forge.db"

# Create directories on import if they don't exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

MODELS_REGISTRY: list[dict] = [
    {
        "id": "flux2-klein-4b-sdnq",
        "name": "FLUX.2-klein-4B (4bit SDNQ)",
        "repo_id": "Disty0/FLUX.2-klein-4B-SDNQ-4bit-dynamic",
        "tokenizer_repo": "black-forest-labs/FLUX.2-klein-4B",
        "type": "txt2img+img2img",
        "pipeline_class": "Flux2KleinPipeline",
        "min_ram_gb": 8,
        "rec_ram_gb": 16,
        "default_steps": 20,
        "default_cfg": 3.5,
        "supports_img2img": True,
        "quantization": "sdnq",
    },
    {
        "id": "flux2-klein-9b-sdnq",
        "name": "FLUX.2-klein-9B (4bit SDNQ)",
        "repo_id": "Disty0/FLUX.2-klein-9B-SDNQ-4bit-dynamic-svd-r32",
        "tokenizer_repo": "black-forest-labs/FLUX.2-klein-9B",
        "type": "txt2img+img2img",
        "pipeline_class": "Flux2KleinPipeline",
        "min_ram_gb": 12,
        "rec_ram_gb": 24,
        "default_steps": 20,
        "default_cfg": 3.5,
        "supports_img2img": True,
        "quantization": "sdnq",
    },
    {
        "id": "flux2-klein-4b-int8",
        "name": "FLUX.2-klein-4B (Int8)",
        "repo_id": "aydin99/FLUX.2-klein-4B-int8",
        "tokenizer_repo": "black-forest-labs/FLUX.2-klein-4B",
        "type": "txt2img+img2img",
        "pipeline_class": "Flux2KleinPipeline",
        "min_ram_gb": 16,
        "rec_ram_gb": 16,
        "default_steps": 20,
        "default_cfg": 3.5,
        "supports_img2img": True,
        "quantization": "quanto-int8",
    },
    {
        "id": "zimage-turbo-quant",
        "name": "Z-Image Turbo (Quantized)",
        "repo_id": "Disty0/Z-Image-Turbo-SDNQ-uint4-svd-r32",
        "tokenizer_repo": None,
        "type": "txt2img",
        "pipeline_class": "ZImagePipeline",
        "min_ram_gb": 8,
        "rec_ram_gb": 8,
        "default_steps": 4,
        "default_cfg": 0.0,
        "supports_img2img": False,
        "quantization": "sdnq",
    },
    {
        "id": "zimage-turbo-full",
        "name": "Z-Image Turbo (Full)",
        "repo_id": "Tongyi-MAI/Z-Image-Turbo",
        "tokenizer_repo": None,
        "type": "txt2img",
        "pipeline_class": "ZImagePipeline",
        "min_ram_gb": 24,
        "rec_ram_gb": 32,
        "default_steps": 4,
        "default_cfg": 0.0,
        "supports_img2img": False,
        "quantization": None,
    },
]

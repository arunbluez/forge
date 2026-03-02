"""System information endpoint."""

import platform
import shutil
import subprocess
from typing import Optional

from fastapi import APIRouter

from backend.config import API_PREFIX, MODELS_REGISTRY

router = APIRouter(prefix=API_PREFIX, tags=["system"])


def _get_total_ram_gb() -> float:
    """Return total system RAM in gigabytes."""
    try:
        import psutil
        return psutil.virtual_memory().total / (1024 ** 3)
    except ImportError:
        pass

    # Fallback for macOS: use sysctl to read total physical memory
    try:
        output = subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True)
        return int(output.strip()) / (1024 ** 3)
    except (FileNotFoundError, subprocess.CalledProcessError, ValueError):
        pass

    # Fallback for Linux: read from /proc/meminfo
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    kb = int(line.split()[1])
                    return kb / (1024 ** 2)
    except (FileNotFoundError, ValueError):
        pass

    return 0.0


def _detect_gpu_type() -> str:
    """Detect available GPU acceleration type."""
    try:
        import torch
        if torch.backends.mps.is_available():
            return "mps"
        if torch.cuda.is_available():
            return "cuda"
    except (ImportError, AttributeError):
        pass
    return "cpu"


def _recommend_model(ram_gb: float) -> Optional[str]:
    """Recommend a model based on available RAM."""
    # Sort models by rec_ram_gb descending so we pick the best that fits
    candidates = sorted(MODELS_REGISTRY, key=lambda m: m["rec_ram_gb"], reverse=True)
    for model in candidates:
        if ram_gb >= model["min_ram_gb"]:
            return model["id"]
    return None


@router.get("/system")
async def system_info() -> dict:
    """Return system information useful for model selection."""
    ram_gb = round(_get_total_ram_gb(), 1)
    gpu_type = _detect_gpu_type()
    recommended_model = _recommend_model(ram_gb)

    return {
        "platform": platform.system(),
        "architecture": platform.machine(),
        "python_version": platform.python_version(),
        "total_ram_gb": ram_gb,
        "gpu_type": gpu_type,
        "recommended_model": recommended_model,
    }

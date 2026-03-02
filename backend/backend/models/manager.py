"""Model manager for downloading, loading, and unloading AI models."""

import asyncio
import gc
import json
import logging
import os
import platform
import shutil
import threading
from pathlib import Path
from typing import Any, Callable, Optional

from backend.config import MODELS_REGISTRY

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# HuggingFace cache helpers
# ---------------------------------------------------------------------------

def _get_hf_cache_dir() -> str:
    """Return the HuggingFace Hub cache directory path."""
    # Respect HF_HOME / HF_HUB_CACHE env vars, else default
    hf_hub_cache = os.environ.get("HF_HUB_CACHE")
    if hf_hub_cache:
        return hf_hub_cache
    hf_home = os.environ.get("HF_HOME")
    if hf_home:
        return os.path.join(hf_home, "hub")
    return os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub")


def _repo_cache_path(repo_id: str) -> str:
    """Return the expected cache directory for a given HF repo_id."""
    cache_name = f"models--{repo_id.replace('/', '--')}"
    return os.path.join(_get_hf_cache_dir(), cache_name)


def _dir_size(path: str) -> int:
    """Walk *path* and return total file size in bytes."""
    total = 0
    try:
        for dirpath, _dirnames, filenames in os.walk(path):
            for fname in filenames:
                fp = os.path.join(dirpath, fname)
                if os.path.isfile(fp):
                    total += os.path.getsize(fp)
    except Exception:
        pass
    return total


def _is_model_cached(repo_id: str) -> bool:
    """Check whether *repo_id* has already been downloaded to the HF cache."""
    cache_path = _repo_cache_path(repo_id)
    if not os.path.isdir(cache_path):
        return False
    # A valid download will have a snapshots/ dir with at least one ref
    snapshots = os.path.join(cache_path, "snapshots")
    if not os.path.isdir(snapshots):
        return False
    # Check that at least one snapshot directory exists and is non-empty
    try:
        for entry in os.listdir(snapshots):
            snap_dir = os.path.join(snapshots, entry)
            if os.path.isdir(snap_dir) and os.listdir(snap_dir):
                return True
    except OSError:
        pass
    return False


# ---------------------------------------------------------------------------
# Device / dtype detection
# ---------------------------------------------------------------------------

def _detect_device() -> str:
    """Return the best available torch device string."""
    try:
        import torch

        if platform.system() == "Darwin" and platform.machine() == "arm64":
            if torch.backends.mps.is_available():
                return "mps"
        if torch.cuda.is_available():
            return "cuda"
    except (ImportError, AttributeError):
        pass
    return "cpu"


def _pick_dtype(device: str, quantization: Optional[str]):
    """Return the appropriate torch dtype for the given device and quantization."""
    import torch

    if quantization == "sdnq":
        # SDNQ on MPS needs float32; CUDA can use float16
        if device == "mps":
            return torch.float32
        if device == "cuda":
            return torch.float16
        return torch.float32

    # Default: bfloat16 where supported, else float32
    if device in ("mps", "cuda"):
        return torch.bfloat16
    return torch.float32


# ---------------------------------------------------------------------------
# Memory optimisation helpers
# ---------------------------------------------------------------------------

def _apply_memory_optimizations(pipe: Any) -> None:
    """Apply standard memory-saving optimisations to a diffusers pipeline."""
    try:
        pipe.enable_attention_slicing()
    except Exception:
        pass

    try:
        if hasattr(pipe, "enable_vae_slicing"):
            pipe.enable_vae_slicing()
    except Exception:
        pass

    try:
        if hasattr(pipe, "enable_vae_tiling"):
            pipe.enable_vae_tiling()
        elif hasattr(getattr(pipe, "vae", None), "enable_tiling"):
            pipe.vae.enable_tiling()
    except Exception:
        pass


def _clear_device_cache(device: str) -> None:
    """Clear GPU memory caches for *device*."""
    try:
        import torch

        if device == "cuda" and torch.cuda.is_available():
            torch.cuda.empty_cache()
        if device == "mps" and hasattr(torch, "mps") and hasattr(torch.mps, "empty_cache"):
            torch.mps.empty_cache()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Registry helpers
# ---------------------------------------------------------------------------

def _registry_entry(model_id: str) -> Optional[dict]:
    """Find and return the registry dict for *model_id*, or ``None``."""
    return next((m for m in MODELS_REGISTRY if m["id"] == model_id), None)


# ---------------------------------------------------------------------------
# Individual model loaders
# ---------------------------------------------------------------------------

def _load_sdnq_model(entry: dict, device: str):
    """Load an SDNQ-quantised model (flux2-klein-4b-sdnq, flux2-klein-9b-sdnq, zimage-turbo-quant)."""
    # Import sdnq first -- it registers custom torch classes required by the checkpoint
    import sdnq  # noqa: F401
    from diffusers import FlowMatchEulerDiscreteScheduler

    pipeline_cls_name = entry["pipeline_class"]

    # Dynamically import the correct pipeline class from diffusers
    import diffusers
    PipelineClass = getattr(diffusers, pipeline_cls_name)

    repo_id: str = entry["repo_id"]
    tokenizer_repo: Optional[str] = entry.get("tokenizer_repo")
    dtype = _pick_dtype(device, "sdnq")

    logger.info("Loading SDNQ model %s (pipeline=%s, dtype=%s)", repo_id, pipeline_cls_name, dtype)

    kwargs: dict[str, Any] = {
        "torch_dtype": dtype,
        "low_cpu_mem_usage": True,
    }

    # If a separate tokenizer repo is specified, pre-load and inject it
    tokenizer = None
    if tokenizer_repo:
        from transformers import AutoTokenizer

        logger.info("  Loading tokenizer from %s", tokenizer_repo)
        tokenizer = AutoTokenizer.from_pretrained(
            tokenizer_repo,
            subfolder="tokenizer",
            use_fast=False,
        )
        kwargs["tokenizer"] = tokenizer

    pipe = PipelineClass.from_pretrained(repo_id, **kwargs)

    # Override scheduler for cleaner sampling
    pipe.scheduler = FlowMatchEulerDiscreteScheduler.from_config(
        pipe.scheduler.config,
        use_beta_sigmas=True,
    )

    pipe.to(device)
    _apply_memory_optimizations(pipe)

    logger.info("  SDNQ model %s ready on %s", entry["id"], device)
    return pipe


def _load_quanto_int8_model(entry: dict, device: str):
    """Load a quanto-int8 quantised model (flux2-klein-4b-int8)."""
    import torch
    from huggingface_hub import snapshot_download
    from transformers import AutoTokenizer, AutoConfig, Qwen3ForCausalLM
    from optimum.quanto import requantize
    from accelerate import init_empty_weights
    from safetensors.torch import load_file
    from diffusers.models.transformers.transformer_flux2 import Flux2Transformer2DModel

    pipeline_cls_name = entry["pipeline_class"]
    import diffusers
    PipelineClass = getattr(diffusers, pipeline_cls_name)

    repo_id: str = entry["repo_id"]
    tokenizer_repo: str = entry.get("tokenizer_repo") or repo_id

    logger.info("Loading quanto-int8 model %s", repo_id)

    # ---- Step 1: download / locate model files ----
    model_path = snapshot_download(repo_id)
    logger.info("  Model files at %s", model_path)

    # ---- Step 2: load quantised transformer ----
    logger.info("  Loading int8 transformer ...")
    # Inline equivalent of QuantizedFlux2Transformer2DModel.from_pretrained
    # We re-implement the critical path here so we don't depend on the
    # external quantized_flux2.py file from ultra-fast-image-gen.
    transformer_qmap_path = os.path.join(model_path, "quanto_qmap.json")
    if not os.path.exists(transformer_qmap_path):
        raise FileNotFoundError(
            f"quanto_qmap.json not found at {transformer_qmap_path} -- "
            "is this a valid quanto-int8 model?"
        )

    with open(transformer_qmap_path, "r", encoding="utf-8") as f:
        transformer_qmap = json.load(f)

    config = Flux2Transformer2DModel.load_config(model_path)
    with init_empty_weights():
        transformer = Flux2Transformer2DModel.from_config(config)

    # Load state dict -- may be sharded or single file
    from diffusers.utils import (
        SAFE_WEIGHTS_INDEX_NAME,
        SAFETENSORS_WEIGHTS_NAME,
        _get_checkpoint_shard_files,
    )
    from diffusers.models.model_loading_utils import load_state_dict as diffusers_load_state_dict

    index_file = os.path.join(model_path, SAFE_WEIGHTS_INDEX_NAME)
    if os.path.exists(index_file):
        from optimum.quanto.models.shared_dict import ShardedStateDict

        _, sharded_metadata = _get_checkpoint_shard_files(model_path, index_file)
        state_dict: Any = ShardedStateDict(model_path, sharded_metadata["weight_map"])
    else:
        weights_file = os.path.join(model_path, SAFETENSORS_WEIGHTS_NAME)
        if not os.path.exists(weights_file):
            raise FileNotFoundError(f"No safetensor weights found in {model_path}")
        state_dict = diffusers_load_state_dict(weights_file)

    requantize(transformer, state_dict=state_dict, quantization_map=transformer_qmap)
    transformer.eval()
    transformer.to(device=device, dtype=torch.bfloat16)
    logger.info("  Transformer loaded.")

    # ---- Step 3: load quantised text encoder ----
    logger.info("  Loading int8 text encoder ...")
    te_dir = os.path.join(model_path, "text_encoder")
    te_config = AutoConfig.from_pretrained(te_dir, trust_remote_code=True)
    with init_empty_weights():
        text_encoder = Qwen3ForCausalLM(te_config)

    te_qmap_path = os.path.join(te_dir, "quanto_qmap.json")
    with open(te_qmap_path, "r", encoding="utf-8") as f:
        te_qmap = json.load(f)

    te_weights = load_file(os.path.join(te_dir, "model.safetensors"))
    requantize(text_encoder, state_dict=te_weights, quantization_map=te_qmap)
    text_encoder.eval()
    text_encoder.to(device, dtype=torch.bfloat16)
    logger.info("  Text encoder loaded.")

    # ---- Step 4: tokenizer ----
    tokenizer_path = os.path.join(model_path, "tokenizer")
    if os.path.isdir(tokenizer_path):
        tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)
    else:
        tokenizer = AutoTokenizer.from_pretrained(
            tokenizer_repo, subfolder="tokenizer", use_fast=False,
        )
    logger.info("  Tokenizer loaded.")

    # ---- Step 5: assemble pipeline ----
    logger.info("  Assembling pipeline ...")
    pipe = PipelineClass.from_pretrained(
        tokenizer_repo,
        transformer=None,
        text_encoder=None,
        tokenizer=None,
        torch_dtype=torch.bfloat16,
    )
    pipe.transformer = transformer
    pipe.text_encoder = text_encoder
    pipe.tokenizer = tokenizer
    pipe.to(device)

    _apply_memory_optimizations(pipe)

    logger.info("  quanto-int8 model %s ready on %s", entry["id"], device)
    return pipe


def _load_full_precision_model(entry: dict, device: str):
    """Load a full-precision model (zimage-turbo-full)."""
    import torch
    from diffusers import FlowMatchEulerDiscreteScheduler

    pipeline_cls_name = entry["pipeline_class"]
    import diffusers
    PipelineClass = getattr(diffusers, pipeline_cls_name)

    repo_id: str = entry["repo_id"]
    dtype = torch.bfloat16 if device in ("mps", "cuda") else torch.float32

    logger.info("Loading full-precision model %s (dtype=%s)", repo_id, dtype)

    pipe = PipelineClass.from_pretrained(
        repo_id,
        torch_dtype=dtype,
        low_cpu_mem_usage=True,
    )

    pipe.scheduler = FlowMatchEulerDiscreteScheduler.from_config(
        pipe.scheduler.config,
        use_beta_sigmas=True,
    )

    pipe.to(device)
    _apply_memory_optimizations(pipe)

    logger.info("  Full-precision model %s ready on %s", entry["id"], device)
    return pipe


# ===========================================================================
# ModelManager
# ===========================================================================

class ModelManager:
    """Manages the lifecycle of AI models: download, load, unload, delete."""

    def __init__(self) -> None:
        self._loaded_model_id: Optional[str] = None
        self._pipeline: Any = None
        self._device: str = _detect_device()

        # Thread safety for load / unload
        self._lock = threading.Lock()

        # Download state tracking
        # Key = model_id, Value = dict with keys:
        #   "is_downloading": bool
        #   "progress": float (0-100)
        #   "cancel_requested": bool
        self._download_state: dict[str, dict] = {}

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def device(self) -> str:
        return self._device

    @property
    def pipeline(self) -> Any:
        return self._pipeline

    def get_loaded_model_id(self) -> Optional[str]:
        """Return the ID of the currently loaded model, or ``None``."""
        return self._loaded_model_id

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    async def load_model(self, model_id: str) -> bool:
        """Load a model into memory. Returns ``True`` on success."""
        entry = _registry_entry(model_id)
        if entry is None:
            logger.error("load_model: unknown model %s", model_id)
            return False

        with self._lock:
            # Unload any currently loaded model first
            if self._loaded_model_id is not None:
                logger.info("Unloading current model %s before loading %s",
                            self._loaded_model_id, model_id)
                await self._unload_model_internal()

            try:
                quantization = entry.get("quantization")
                if quantization == "sdnq":
                    pipe = _load_sdnq_model(entry, self._device)
                elif quantization == "quanto-int8":
                    pipe = _load_quanto_int8_model(entry, self._device)
                elif quantization is None:
                    pipe = _load_full_precision_model(entry, self._device)
                else:
                    logger.error("Unknown quantization type: %s", quantization)
                    return False

                self._pipeline = pipe
                self._loaded_model_id = model_id
                logger.info("Model %s loaded successfully on %s", model_id, self._device)
                return True

            except Exception:
                logger.exception("Failed to load model %s", model_id)
                # Clean up partial state
                self._pipeline = None
                self._loaded_model_id = None
                gc.collect()
                _clear_device_cache(self._device)
                return False

    # ------------------------------------------------------------------
    # Model unloading
    # ------------------------------------------------------------------

    async def unload_model(self) -> None:
        """Unload the currently loaded model and free memory."""
        with self._lock:
            await self._unload_model_internal()

    async def _unload_model_internal(self) -> None:
        """Inner unload logic -- caller must hold ``self._lock``."""
        if self._pipeline is None and self._loaded_model_id is None:
            logger.debug("unload_model: nothing to unload.")
            return

        prev_id = self._loaded_model_id
        logger.info("Unloading model %s ...", prev_id)

        try:
            del self._pipeline
        except Exception:
            pass

        self._pipeline = None
        self._loaded_model_id = None

        gc.collect()
        _clear_device_cache(self._device)

        logger.info("Model %s unloaded. Memory caches cleared.", prev_id)

    # ------------------------------------------------------------------
    # Model downloading
    # ------------------------------------------------------------------

    async def download_model(
        self,
        model_id: str,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> None:
        """Download a model from the Hugging Face Hub.

        Progress (0-100) is tracked in ``self._download_state[model_id]``
        and optionally reported via *progress_callback*.

        The actual download runs in a thread so it does not block the
        asyncio event loop (allowing progress-polling requests to be served).

        Raises ``ValueError`` for unknown models and ``RuntimeError`` on
        download failure.
        """
        entry = _registry_entry(model_id)
        if entry is None:
            raise ValueError(f"Unknown model: {model_id}")

        repo_id: str = entry["repo_id"]
        tokenizer_repo: Optional[str] = entry.get("tokenizer_repo")
        has_tokenizer = tokenizer_repo and tokenizer_repo != repo_id

        # Initialise download state
        self._download_state[model_id] = {
            "is_downloading": True,
            "progress": 0.0,
            "cancel_requested": False,
        }

        state = self._download_state[model_id]

        def _do_download() -> None:
            from huggingface_hub import snapshot_download
            from tqdm import tqdm as tqdm_base

            # Build a custom tqdm subclass that feeds aggregate progress
            # back into ``state["progress"]``.
            lock = threading.Lock()
            agg = {"total": 0, "completed": 0}

            # If there's a tokenizer repo, reserve 5 % of the bar for it
            model_weight = 0.95 if has_tokenizer else 1.0

            class _ProgressTqdm(tqdm_base):
                def __init__(self, *args: Any, **kwargs: Any) -> None:
                    kwargs["disable"] = True  # suppress terminal output
                    super().__init__(*args, **kwargs)
                    if self.total and self.total > 0:
                        with lock:
                            agg["total"] += self.total

                def update(self, n: int = 1) -> Any:
                    result = super().update(n)
                    with lock:
                        agg["completed"] += n
                        if agg["total"] > 0:
                            raw = (agg["completed"] / agg["total"]) * 100
                            state["progress"] = min(
                                round(raw * model_weight, 1), 99.9
                            )
                    return result

            logger.info("Starting download: %s (%s)", model_id, repo_id)

            snapshot_download(repo_id, tqdm_class=_ProgressTqdm)

            if state.get("cancel_requested"):
                logger.info("Download of %s was cancelled.", model_id)
                state["is_downloading"] = False
                state["progress"] = 0.0
                return

            logger.info("Download complete: %s", model_id)

            # Also download the tokenizer repo if configured and different
            if has_tokenizer:
                logger.info("Downloading tokenizer repo: %s", tokenizer_repo)
                snapshot_download(tokenizer_repo)
                logger.info("Tokenizer repo download complete: %s", tokenizer_repo)

            state["progress"] = 100.0

        try:
            await asyncio.to_thread(_do_download)
        except Exception as exc:
            logger.exception("Download failed for %s", model_id)
            state["progress"] = 0.0
            raise RuntimeError(f"Download failed for {model_id}: {exc}") from exc
        finally:
            state["is_downloading"] = False

    def cancel_download(self, model_id: str) -> None:
        """Request cancellation of an in-progress download."""
        state = self._download_state.get(model_id)
        if state and state.get("is_downloading"):
            state["cancel_requested"] = True
            logger.info("Cancellation requested for download of %s", model_id)

    # ------------------------------------------------------------------
    # Model deletion
    # ------------------------------------------------------------------

    async def delete_model(self, model_id: str) -> bool:
        """Delete a downloaded model from disk. Returns ``True`` on success."""
        entry = _registry_entry(model_id)
        if entry is None:
            logger.error("delete_model: unknown model %s", model_id)
            return False

        # Unload if this model is currently loaded
        if self._loaded_model_id == model_id:
            await self.unload_model()

        repo_id: str = entry["repo_id"]
        cache_path = _repo_cache_path(repo_id)

        if not os.path.isdir(cache_path):
            logger.info("delete_model: cache dir does not exist for %s", model_id)
            return True  # Already gone

        try:
            shutil.rmtree(cache_path)
            logger.info("Deleted model cache: %s (%s)", model_id, cache_path)
        except Exception:
            logger.exception("Failed to delete model cache for %s at %s", model_id, cache_path)
            return False

        # Also try to delete the tokenizer repo cache if separate
        tokenizer_repo = entry.get("tokenizer_repo")
        if tokenizer_repo and tokenizer_repo != repo_id:
            tok_cache = _repo_cache_path(tokenizer_repo)
            if os.path.isdir(tok_cache):
                try:
                    shutil.rmtree(tok_cache)
                    logger.info("Deleted tokenizer cache: %s", tok_cache)
                except Exception:
                    logger.warning("Could not delete tokenizer cache at %s", tok_cache)

        return True

    # ------------------------------------------------------------------
    # Status / introspection
    # ------------------------------------------------------------------

    async def get_download_status(self, model_id: str) -> dict:
        """Return download status dict for a specific model."""
        entry = _registry_entry(model_id)
        if entry is None:
            return {"model_id": model_id, "error": "unknown_model"}

        repo_id: str = entry["repo_id"]
        is_downloaded = _is_model_cached(repo_id)

        # Check live download state
        ds = self._download_state.get(model_id, {})
        is_downloading = ds.get("is_downloading", False)
        download_progress = ds.get("progress", 0.0)

        # If fully downloaded and not currently downloading, progress = 100
        if is_downloaded and not is_downloading:
            download_progress = 100.0

        disk_size = self.get_disk_usage(model_id)

        return {
            "model_id": model_id,
            "is_downloaded": is_downloaded,
            "is_downloading": is_downloading,
            "download_progress": round(download_progress, 1),
            "disk_size_bytes": disk_size,
        }

    def get_disk_usage(self, model_id: str) -> int:
        """Return disk usage in bytes for a specific model."""
        entry = _registry_entry(model_id)
        if entry is None:
            return 0

        repo_id: str = entry["repo_id"]
        cache_path = _repo_cache_path(repo_id)

        total = _dir_size(cache_path)

        # Include tokenizer repo size if separate
        tokenizer_repo = entry.get("tokenizer_repo")
        if tokenizer_repo and tokenizer_repo != repo_id:
            total += _dir_size(_repo_cache_path(tokenizer_repo))

        return total

    def get_total_disk_usage(self) -> int:
        """Return total disk usage in bytes across all downloaded models."""
        # Collect unique repo_ids to avoid double-counting shared tokenizer repos
        counted_repos: set[str] = set()
        total = 0
        for entry in MODELS_REGISTRY:
            repo_id = entry["repo_id"]
            if repo_id not in counted_repos:
                counted_repos.add(repo_id)
                total += _dir_size(_repo_cache_path(repo_id))

            tokenizer_repo = entry.get("tokenizer_repo")
            if tokenizer_repo and tokenizer_repo != repo_id and tokenizer_repo not in counted_repos:
                counted_repos.add(tokenizer_repo)
                total += _dir_size(_repo_cache_path(tokenizer_repo))

        return total

    async def get_all_models_status(self) -> list[dict]:
        """Return all models from the registry with their current status."""
        result = []
        for model in MODELS_REGISTRY:
            status = await self.get_download_status(model["id"])
            entry = {
                **model,
                **status,
                "loaded": model["id"] == self._loaded_model_id,
            }
            result.append(entry)
        return result

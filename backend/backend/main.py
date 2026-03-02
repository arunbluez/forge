"""Forge Backend - FastAPI application entry point."""

import os

# Enable fast math for Apple Silicon MPS
os.environ["PYTORCH_MPS_FAST_MATH"] = "1"

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import DEFAULT_HOST, DEFAULT_PORT
from backend.database import init_db
from backend.models.manager import ModelManager
from backend.routes import health, system, models, gallery, generate, settings
from backend.settings import apply_saved_settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown."""
    logger.info("Starting Forge Backend...")
    apply_saved_settings()
    await init_db()
    logger.info("Database initialized.")

    # Create the global model manager and attach to app state
    app.state.model_manager = ModelManager()
    logger.info("ModelManager initialized.")

    yield

    # Cleanup: unload any loaded model before shutdown
    logger.info("Shutting down Forge Backend...")
    await app.state.model_manager.unload_model()
    logger.info("ModelManager cleaned up.")


app = FastAPI(
    title="Forge Backend",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware - allow all origins for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(system.router)
app.include_router(models.router)
app.include_router(gallery.router)
app.include_router(generate.router)
app.include_router(settings.router)


if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=DEFAULT_HOST,
        port=DEFAULT_PORT,
        reload=True,
    )

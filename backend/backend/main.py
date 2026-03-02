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
from backend.routes import health, system, models, gallery, generate

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown."""
    logger.info("Starting Forge Backend...")
    await init_db()
    logger.info("Database initialized.")
    yield
    logger.info("Shutting down Forge Backend...")


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


if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=DEFAULT_HOST,
        port=DEFAULT_PORT,
        reload=True,
    )

"""Image generation endpoints including WebSocket streaming."""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.config import API_PREFIX

logger = logging.getLogger(__name__)

router = APIRouter(prefix=API_PREFIX, tags=["generate"])


@router.websocket("/ws/generate")
async def ws_generate(websocket: WebSocket) -> None:
    """WebSocket endpoint for image generation with progress streaming. (Stub)"""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            # Stub: acknowledge the request
            await websocket.send_json({
                "type": "status",
                "message": "Generation endpoint not yet implemented.",
            })
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")


@router.post("/generate/cancel")
async def cancel_generation() -> dict:
    """Cancel the currently running generation. (Stub)"""
    return {"status": "no_active_generation"}

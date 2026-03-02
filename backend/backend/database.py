"""Forge database management using aiosqlite."""

import uuid
from datetime import datetime, timezone
from typing import Optional

import aiosqlite

from backend.config import DB_PATH

_CREATE_GALLERY_TABLE = """
CREATE TABLE IF NOT EXISTS gallery (
    id TEXT PRIMARY KEY,
    prompt TEXT,
    negative_prompt TEXT,
    model_id TEXT,
    seed INTEGER,
    width INTEGER,
    height INTEGER,
    steps INTEGER,
    guidance_scale REAL,
    created_at TEXT,
    image_path TEXT,
    source_images TEXT,
    generation_time_ms INTEGER
);
"""

_CREATE_FTS_TABLE = """
CREATE VIRTUAL TABLE IF NOT EXISTS gallery_fts USING fts5(
    prompt,
    content=gallery,
    content_rowid=rowid
);
"""

_CREATE_FTS_TRIGGERS = """
CREATE TRIGGER IF NOT EXISTS gallery_ai AFTER INSERT ON gallery BEGIN
    INSERT INTO gallery_fts(rowid, prompt) VALUES (new.rowid, new.prompt);
END;

CREATE TRIGGER IF NOT EXISTS gallery_ad AFTER DELETE ON gallery BEGIN
    INSERT INTO gallery_fts(gallery_fts, rowid, prompt) VALUES ('delete', old.rowid, old.prompt);
END;

CREATE TRIGGER IF NOT EXISTS gallery_au AFTER UPDATE ON gallery BEGIN
    INSERT INTO gallery_fts(gallery_fts, rowid, prompt) VALUES ('delete', old.rowid, old.prompt);
    INSERT INTO gallery_fts(rowid, prompt) VALUES (new.rowid, new.prompt);
END;
"""


async def _get_connection() -> aiosqlite.Connection:
    """Open a connection to the database."""
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    return db


async def init_db() -> None:
    """Initialize the database and create tables if they don't exist."""
    async with aiosqlite.connect(str(DB_PATH)) as db:
        await db.executescript(_CREATE_GALLERY_TABLE)
        await db.executescript(_CREATE_FTS_TABLE)
        await db.executescript(_CREATE_FTS_TRIGGERS)
        await db.commit()


async def create_entry(
    prompt: str,
    model_id: str,
    seed: int,
    width: int,
    height: int,
    steps: int,
    guidance_scale: float,
    image_path: str,
    generation_time_ms: int,
    negative_prompt: Optional[str] = None,
    source_images: Optional[str] = None,
) -> dict:
    """Create a new gallery entry and return it as a dict."""
    entry_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            """
            INSERT INTO gallery
                (id, prompt, negative_prompt, model_id, seed, width, height,
                 steps, guidance_scale, created_at, image_path, source_images,
                 generation_time_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry_id,
                prompt,
                negative_prompt,
                model_id,
                seed,
                width,
                height,
                steps,
                guidance_scale,
                created_at,
                image_path,
                source_images,
                generation_time_ms,
            ),
        )
        await db.commit()

        cursor = await db.execute("SELECT * FROM gallery WHERE id = ?", (entry_id,))
        row = await cursor.fetchone()
        return dict(row) if row else {}


async def get_entries(limit: int = 50, offset: int = 0) -> list[dict]:
    """Return paginated gallery entries, newest first."""
    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM gallery ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def search_entries(query: str, limit: int = 50, offset: int = 0) -> list[dict]:
    """Search gallery entries by prompt using FTS5."""
    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT gallery.* FROM gallery
            JOIN gallery_fts ON gallery.rowid = gallery_fts.rowid
            WHERE gallery_fts MATCH ?
            ORDER BY gallery.created_at DESC
            LIMIT ? OFFSET ?
            """,
            (query, limit, offset),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_entry_by_id(entry_id: str) -> Optional[dict]:
    """Get a single gallery entry by its ID."""
    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM gallery WHERE id = ?", (entry_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def delete_entry(entry_id: str) -> bool:
    """Delete a gallery entry by ID. Returns True if a row was deleted."""
    async with aiosqlite.connect(str(DB_PATH)) as db:
        cursor = await db.execute("DELETE FROM gallery WHERE id = ?", (entry_id,))
        await db.commit()
        return cursor.rowcount > 0

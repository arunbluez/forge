# Forge

Local-first AI image studio for Mac. Generate images with state-of-the-art diffusion models running entirely on your machine — no cloud, no API keys, no telemetry.

## Features

- **Text-to-image & image-to-image** generation with real-time streaming preview
- **5 quantized models** optimized for Apple Silicon (8GB–32GB RAM)
- **Gallery** with SQLite-backed search, metadata, remix, and export
- **Model manager** with one-click downloads, RAM detection, and recommendations
- **First-run onboarding** that guides you through your first model download
- **100% local** — your images and prompts never leave your machine

## Architecture

```
forge/
├── app/                    # Shared React UI package
│   └── src/
│       ├── components/     # Studio, Gallery, ModelManager, Onboarding
│       ├── hooks/          # useGeneration, useBackendHealth
│       ├── stores/         # Zustand state (server, generation)
│       ├── lib/api/        # API client + TypeScript types
│       └── pages/          # Route pages
├── tauri/                  # Tauri v2 desktop shell
│   └── src-tauri/          # Rust sidecar management
├── backend/                # Python FastAPI backend
│   └── backend/
│       ├── models/         # ModelManager, inference engine
│       ├── routes/         # REST + WebSocket endpoints
│       ├── database.py     # SQLite with FTS5 search
│       └── config.py       # Model registry
└── scripts/                # Build & dev helper scripts
```

## Prerequisites

- **macOS** 13+ (Ventura or later) with Apple Silicon recommended
- **Python** 3.11+
- **Node.js** 20+
- **Rust** (latest stable) — install via [rustup](https://rustup.rs)

## Quick Start (Development)

### 1. Install dependencies

```bash
# Frontend dependencies
npm install

# Backend dependencies
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 2. Create the dev sidecar placeholder

Tauri requires the sidecar binary to exist at compile time, even in dev mode:

```bash
npm run setup:dev
```

### 3. Start the backend

In one terminal:

```bash
cd backend
source .venv/bin/activate
python -m backend.main
```

The backend runs at `http://127.0.0.1:8188`. You can verify with:

```bash
curl http://127.0.0.1:8188/api/v1/health
```

### 4. Start the frontend

In another terminal:

```bash
npm run dev
```

This starts the Vite dev server at `http://localhost:5173` inside the Tauri window.

### Browser-only mode

If you don't have Rust/Tauri installed yet, you can run just the Vite dev server directly:

```bash
cd tauri && npx vite
```

Then open `http://localhost:5173` in your browser. The UI will connect to the backend at port 8188.

## Supported Models

| Model | RAM | Speed | Type |
|-------|-----|-------|------|
| FLUX.2-klein-4B (4bit SDNQ) | 8 GB+ | Fast | txt2img + img2img |
| FLUX.2-klein-9B (4bit SDNQ) | 12 GB+ | Medium | txt2img + img2img |
| FLUX.2-klein-4B (Int8) | 16 GB+ | Medium | txt2img + img2img |
| Z-Image Turbo (Quantized) | 8 GB+ | Very fast | txt2img |
| Z-Image Turbo (Full) | 24 GB+ | Very fast | txt2img |

Models are downloaded on-demand through the Model Manager or during onboarding.

## Building for Distribution

```bash
# Build the backend into a standalone binary
npm run build:server

# Build the full Tauri app (includes backend sidecar)
npm run build
```

The `.dmg` / `.app` bundle will be in `tauri/src-tauri/target/release/bundle/`.

## API Endpoints

The backend exposes these endpoints at `http://127.0.0.1:8188/api/v1`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Backend health check |
| `/system` | GET | System info (RAM, platform, recommended model) |
| `/models` | GET | List all models with download/load status |
| `/models/{id}/download` | POST | Start model download |
| `/models/{id}/download/progress` | GET | Download progress |
| `/models/{id}/load` | POST | Load model into memory |
| `/models/{id}/unload` | POST | Unload model from memory |
| `/models/{id}` | DELETE | Delete model from disk |
| `/generate` | POST | Start image generation |
| `/generate/stream` | WebSocket | Streaming generation with live preview |
| `/images` | GET | List gallery images (with search) |
| `/images/{id}` | GET | Get image metadata |
| `/images/{id}` | DELETE | Delete image |

## Data Storage

All data is stored locally:

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/Forge/` |
| Linux | `~/.local/share/forge/` |

Override with the `FORGE_DATA_DIR` environment variable.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, Zustand, TanStack Query, Vite 6
- **Desktop**: Tauri v2 (Rust)
- **Backend**: Python, FastAPI, PyTorch, Diffusers, SDNQ/Quanto quantization
- **Storage**: SQLite with FTS5 full-text search
- **Distribution**: PyInstaller (backend binary), Tauri bundler (.dmg/.app)

## License

Private — not yet open source.

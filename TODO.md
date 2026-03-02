# FORGE - Development TODO

## Phase 1: Python Backend API
**Goal**: FastAPI server with REST + WebSocket endpoints, SQLite schema, step-callback streaming from diffusion pipeline.

### 1.1 Project Setup
- [ ] Create Python backend project structure (`backend/`)
- [ ] Set up `pyproject.toml` with dependencies (fastapi, uvicorn, torch, diffusers, optimum-quanto, Pillow, sqlalchemy, aiofiles, huggingface-hub, websockets)
- [ ] Create `requirements.txt` for development
- [ ] Set up Python logging configuration
- [ ] Create configuration management (ports, paths, model registry)

### 1.2 Database Layer
- [ ] Design SQLite schema for gallery entries (id, prompt, negative_prompt, model_id, seed, width, height, steps, guidance_scale, created_at, image_path, source_images_json, generation_time_ms)
- [ ] Implement database initialization and migration
- [ ] Create CRUD operations for gallery entries
- [ ] Implement full-text search on prompt content
- [ ] Implement pagination support for gallery queries

### 1.3 Model Registry & Management
- [ ] Define model registry configuration (model_id, name, description, repo_id, type, min_ram, rec_ram, default_steps, default_cfg, supported_modes)
- [ ] Implement model download with progress tracking via huggingface-hub
- [ ] Implement model deletion (clear from HF cache)
- [ ] Implement model loading/unloading with memory management
- [ ] Implement system RAM detection and model recommendations
- [ ] Implement download cancellation and resumability
- [ ] Track disk usage per model and total

### 1.4 Inference Engine
- [ ] Implement base inference pipeline abstraction
- [ ] Implement FLUX.2-klein-4B (4bit SDNQ) text-to-image pipeline
- [ ] Implement FLUX.2-klein-4B image-to-image pipeline
- [ ] Implement step callback for streaming preview generation
- [ ] Implement preview frame encoding (reduced-quality JPEG base64)
- [ ] Implement generation cancellation (interrupt inference loop)
- [ ] Implement seed management (random seed generation, seed recording)
- [ ] Implement resolution preset calculations (aspect-ratio-preserving)
- [ ] Add MPS (Metal Performance Shaders) backend support for Apple Silicon
- [ ] Add CUDA backend support (best-effort for NVIDIA)

### 1.5 API Endpoints
- [ ] `GET /api/v1/health` - Health check endpoint
- [ ] `GET /api/v1/system` - System info (RAM, GPU type, recommended model)
- [ ] `WS /api/v1/ws/generate` - WebSocket generation with streaming preview
- [ ] `POST /api/v1/generate/cancel` - Cancel current generation
- [ ] `GET /api/v1/models` - List all models with status
- [ ] `POST /api/v1/models/{id}/load` - Load model into memory
- [ ] `POST /api/v1/models/{id}/download` - Start model download
- [ ] `DELETE /api/v1/models/{id}` - Delete model from disk
- [ ] `GET /api/v1/gallery` - Paginated gallery entries
- [ ] `GET /api/v1/gallery/search` - Search gallery by prompt text
- [ ] `DELETE /api/v1/gallery/{id}` - Delete gallery entry and image file
- [ ] Implement WebSocket download progress streaming
- [ ] Add CORS middleware configuration
- [ ] Add error handling middleware with user-friendly messages

### 1.6 Image Storage
- [ ] Implement image save to disk (UUID-named PNG files)
- [ ] Implement image directory management (macOS app support paths)
- [ ] Implement source image handling for img2img (copy and store references)
- [ ] Implement image export functionality
- [ ] Implement gallery entry deletion with file cleanup

---

## Phase 2: Tauri Shell
**Goal**: Tauri project with sidecar management, Python process spawning, health check, auto-restart.

### 2.1 Tauri Project Setup
- [ ] Initialize Tauri project with React + TypeScript template
- [ ] Configure `tauri.conf.json` (app name, identifier, window settings, permissions)
- [ ] Set up Cargo.toml with required Tauri plugins
- [ ] Configure TypeScript/ESLint/Prettier for frontend
- [ ] Set up Tailwind CSS
- [ ] Configure Vite for development and production builds

### 2.2 Sidecar Management (Rust)
- [ ] Implement Python sidecar process spawning
- [ ] Implement health check polling (GET /health with retry logic)
- [ ] Implement auto-restart on backend crash (with backoff)
- [ ] Implement graceful shutdown on app quit (terminate inference, stop backend)
- [ ] Implement backend status tracking (starting, healthy, error, restarting)
- [ ] Expose sidecar status to frontend via Tauri commands

### 2.3 Tauri Commands
- [ ] `get_backend_status` - Return current backend health state
- [ ] `get_app_data_dir` - Return app support directory path
- [ ] `open_file_dialog` - Native file picker for image upload
- [ ] `save_file_dialog` - Native file picker for image export
- [ ] `reveal_in_finder` - Open file location in Finder
- [ ] `get_system_info` - Get system memory and hardware info from Rust side

### 2.4 Window Configuration
- [ ] Set minimum window size (1024x768)
- [ ] Configure default window size (1280x900)
- [ ] Set window title to "Forge"
- [ ] Configure macOS traffic light positioning
- [ ] Enable window resize and maximize
- [ ] Set up custom titlebar area (draggable region)

---

## Phase 3: Core UI (Studio View)
**Goal**: Complete Studio with streaming preview, model switcher, image-to-image upload flow, progress and cancel.

### 3.1 App Layout & Navigation
- [ ] Create main app layout with sidebar navigation
- [ ] Implement routing (Studio, Gallery, Model Manager, Settings)
- [ ] Create sidebar with navigation items and icons
- [ ] Implement dark/light mode support (follow macOS system preference)
- [ ] Set up global state management (Zustand or React Context)
- [ ] Create shared UI components (Button, Input, Select, Slider, Progress)

### 3.2 Backend Connection Layer
- [ ] Create HTTP API client service (fetch wrapper with error handling)
- [ ] Create WebSocket client service for generation streaming
- [ ] Create WebSocket client for download progress
- [ ] Implement connection state management (connected, disconnected, reconnecting)
- [ ] Implement request/response type definitions matching backend API

### 3.3 Studio - Generation Interface
- [ ] Create Studio page layout (prompt area left, preview area right)
- [ ] Implement multiline prompt input field (FR-S-01)
- [ ] Implement model selector dropdown (downloaded models only) (FR-S-02)
- [ ] Implement resolution preset selector (FR-S-03)
- [ ] Implement inference steps input with model-specific defaults (FR-S-04)
- [ ] Implement seed input with random (-1) option (FR-S-05)
- [ ] Implement guidance scale (CFG) slider with model-specific defaults (FR-S-06)
- [ ] Implement Generate button with loading state
- [ ] Implement streaming preview canvas (FR-S-07)
- [ ] Implement progress indicator (step/total/percentage) (FR-S-08)
- [ ] Implement cancel button during generation (FR-S-09)
- [ ] Implement recent images strip at bottom of Studio (FR-S-10)

### 3.4 Studio - Image-to-Image
- [ ] Implement image upload zone (drag-and-drop + file picker) (FR-S-11)
- [ ] Display uploaded reference images as thumbnails with remove buttons (FR-S-12)
- [ ] Auto-adjust resolution preset based on first uploaded image aspect ratio (FR-S-13)
- [ ] Support up to 6 reference images
- [ ] Implement image preview/enlargement on click

### 3.5 Studio - Negative Prompt
- [ ] Add expandable negative prompt input field
- [ ] Include negative prompt in generation parameters

---

## Phase 4: Gallery
**Goal**: Full gallery view with SQLite backend, search, detail panel, remix, and export.

### 4.1 Gallery View
- [ ] Create Gallery page layout with thumbnail grid (FR-G-02)
- [ ] Implement chronological grouping (Today, Yesterday, This Week, etc.)
- [ ] Implement responsive grid layout that adapts to window size
- [ ] Implement lazy loading / virtualized list for performance
- [ ] Implement auto-save of all generated images to gallery (FR-G-01)

### 4.2 Gallery Detail Panel
- [ ] Create detail panel/modal for selected image (FR-G-03)
- [ ] Display full image with zoom capability
- [ ] Display all metadata: prompt, model, seed, dimensions, steps, guidance, date
- [ ] Display source reference images for img2img generations
- [ ] Implement Remix button - loads settings back into Studio (FR-G-04)

### 4.3 Gallery Actions
- [ ] Implement single image export to chosen folder (PNG) (FR-G-05)
- [ ] Implement multi-select and batch export (FR-G-05)
- [ ] Implement search/filter by prompt text (FR-G-06)
- [ ] Implement individual gallery entry deletion (FR-G-07)
- [ ] Ensure gallery persistence between sessions (FR-G-08)

### 4.4 Studio Integration
- [ ] Implement recent images strip in Studio view
- [ ] Implement click-to-view from recent strip to gallery detail
- [ ] Implement remix flow from gallery back to Studio

---

## Phase 5: Model Manager
**Goal**: Model list with download progress, RAM detection, recommendations, delete and storage totals.

### 5.1 Model Manager View
- [ ] Create Model Manager page layout
- [ ] Display all supported models with name, description, type, size (FR-M-01)
- [ ] Show download status per model (not downloaded, downloading, downloaded)
- [ ] Show which model is currently loaded in memory (FR-M-10)

### 5.2 Model Downloads
- [ ] Implement Download button per model (FR-M-02)
- [ ] Implement download progress bar with bytes/total/ETA (FR-M-03)
- [ ] Implement download cancellation (FR-M-04)
- [ ] Handle download errors and retry logic

### 5.3 Model Management
- [ ] Show actual disk size per downloaded model (FR-M-05)
- [ ] Implement Delete button with confirmation (FR-M-05)
- [ ] Unload model from memory if deleting the active model (FR-M-06)
- [ ] Display aggregate total storage used (FR-M-07)

### 5.4 Hardware Recommendations
- [ ] Detect available system RAM (FR-M-08)
- [ ] Display recommendation banner for best model (FR-M-08)
- [ ] Visually flag models that exceed available RAM with warning (FR-M-09)
- [ ] Do NOT block users from downloading/using flagged models (FR-M-09)

---

## Phase 6: Onboarding & Error States
**Goal**: First-run flow, empty states, error states with plain-language messages.

### 6.1 First-Run Onboarding
- [ ] Implement first-launch detection (no models downloaded)
- [ ] Create onboarding welcome screen explaining local-first operation (FR-L-01)
- [ ] Guide user to download their first model before generation is available (FR-L-01)
- [ ] Create "Getting Started" step indicator (Download Model -> Generate First Image)

### 6.2 Empty States
- [ ] Gallery empty state ("No images yet - head to Studio to generate your first image")
- [ ] Studio empty state when no models downloaded ("Download a model to get started")
- [ ] Model Manager empty state (should always have models listed, but handle edge case)

### 6.3 Error States
- [ ] Backend startup failure error screen (FR-L-03)
- [ ] Backend crash detection and auto-restart UI (FR-L-04)
- [ ] Generation failure error message (OOM, model error, etc.)
- [ ] Model download failure error with retry option
- [ ] Network connectivity error for model downloads
- [ ] Plain-language error messages throughout (NFR 8.4)

### 6.4 Application Lifecycle
- [ ] Implement clean termination on app quit (FR-L-05)
- [ ] Implement in-progress generation termination on quit (FR-L-05)
- [ ] Handle backend process lifecycle events in UI

---

## Phase 7: Distribution & Polish
**Goal**: PyInstaller sidecar build, Tauri DMG bundling, macOS code signing, README.

### 7.1 Python Bundling
- [ ] Create PyInstaller spec file for backend sidecar
- [ ] Test sidecar binary runs independently
- [ ] Optimize bundle size (exclude unnecessary packages)
- [ ] Test on macOS 13+ with Apple Silicon

### 7.2 Tauri Bundling
- [ ] Configure Tauri bundler for DMG output
- [ ] Include sidecar binary in Tauri bundle
- [ ] Set up app icons (1024x1024 + all required sizes)
- [ ] Configure Info.plist with correct metadata

### 7.3 macOS Integration
- [ ] Code signing configuration
- [ ] Notarization workflow
- [ ] macOS Gatekeeper compatibility testing
- [ ] Test installation from DMG on clean system

### 7.4 Documentation
- [ ] Write README.md with project description, screenshots, install instructions
- [ ] Write CONTRIBUTING.md with development setup instructions
- [ ] Create CHANGELOG.md
- [ ] Add LICENSE file (MIT)

### 7.5 Final QA
- [ ] Test complete flow: install -> onboard -> download model -> generate -> gallery
- [ ] Test on M1 Mac with 8GB RAM
- [ ] Test on M2/M3/M4 Mac with 16GB+ RAM
- [ ] Test dark mode and light mode
- [ ] Test window resizing and layout responsiveness
- [ ] Verify zero network calls during generation
- [ ] Verify all data stored in correct macOS directories

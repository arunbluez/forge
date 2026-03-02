#!/bin/bash
# Creates a placeholder sidecar binary for development
# (Tauri requires the binary to exist at compile time)
set -e

cd "$(dirname "$0")/.."

ARCH=$(uname -m)
OS=$(uname -s)

if [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        TARGET="aarch64-apple-darwin"
    else
        TARGET="x86_64-apple-darwin"
    fi
elif [ "$OS" = "Linux" ]; then
    TARGET="x86_64-unknown-linux-gnu"
fi

BINARY_PATH="tauri/src-tauri/binaries/forge-server-${TARGET}"
mkdir -p tauri/src-tauri/binaries

if [ ! -f "$BINARY_PATH" ]; then
    echo '#!/bin/bash' > "$BINARY_PATH"
    echo 'echo "Dev placeholder - start the real server with: cd backend && python -m backend.main"' >> "$BINARY_PATH"
    chmod +x "$BINARY_PATH"
    echo "Created dev placeholder at $BINARY_PATH"
else
    echo "Sidecar binary already exists at $BINARY_PATH"
fi

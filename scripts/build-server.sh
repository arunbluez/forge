#!/bin/bash
set -e

echo "Building Forge backend server..."

cd "$(dirname "$0")/.."

# Determine target triple
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

echo "Target: $TARGET"

# Build the binary
cd backend
python build_binary.py

# Copy to Tauri sidecar location
BINARY_NAME="forge-server-${TARGET}"
mkdir -p ../tauri/src-tauri/binaries
cp "dist/${BINARY_NAME}" "../tauri/src-tauri/binaries/${BINARY_NAME}"

echo "Binary copied to tauri/src-tauri/binaries/${BINARY_NAME}"
echo "Build complete!"

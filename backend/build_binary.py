#!/usr/bin/env python3
"""Build the Forge backend into a standalone binary using PyInstaller."""
import PyInstaller.__main__
import platform
import sys


def build():
    target_triple = get_target_triple()

    args = [
        'backend/server.py',  # Entry point
        '--name', f'forge-server-{target_triple}',
        '--onefile',
        '--console',  # Keep console for logging
        # Hidden imports for lazy-loaded modules
        '--hidden-import', 'torch',
        '--hidden-import', 'diffusers',
        '--hidden-import', 'transformers',
        '--hidden-import', 'safetensors',
        '--hidden-import', 'accelerate',
        '--hidden-import', 'huggingface_hub',
        '--hidden-import', 'optimum',
        '--hidden-import', 'peft',
        '--hidden-import', 'uvicorn',
        '--hidden-import', 'fastapi',
        '--hidden-import', 'aiosqlite',
        '--collect-all', 'torch',
        '--collect-all', 'diffusers',
        '--collect-all', 'transformers',
    ]

    PyInstaller.__main__.run(args)


def get_target_triple():
    machine = platform.machine().lower()
    system = platform.system().lower()
    if system == 'darwin':
        if machine in ('arm64', 'aarch64'):
            return 'aarch64-apple-darwin'
        return 'x86_64-apple-darwin'
    elif system == 'linux':
        return 'x86_64-unknown-linux-gnu'
    elif system == 'windows':
        return 'x86_64-pc-windows-msvc'
    return f'{machine}-{system}'


if __name__ == '__main__':
    build()

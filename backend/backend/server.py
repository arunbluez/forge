#!/usr/bin/env python3
"""Forge backend server entry point for PyInstaller builds."""
import argparse
import os
import sys
import uvicorn


def main():
    parser = argparse.ArgumentParser(description='Forge Backend Server')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8188)
    parser.add_argument('--data-dir', default=None, help='Override data directory')
    args = parser.parse_args()

    if args.data_dir:
        os.environ['FORGE_DATA_DIR'] = args.data_dir

    os.environ["PYTORCH_MPS_FAST_MATH"] = "1"

    uvicorn.run(
        'backend.main:app',
        host=args.host,
        port=args.port,
        log_level='info',
    )


if __name__ == '__main__':
    main()

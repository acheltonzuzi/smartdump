#!/usr/bin/env python3
"""
Start the SmartDebugger server.

Usage:
    python run.py              # default port 8765
    python run.py --port 9000  # custom port
"""

import argparse
import sys

import uvicorn


def _add_server_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8765, help="Bind port (default: 8765)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload (dev mode)")


def _run_server(args: argparse.Namespace) -> None:
    print(f"\n  ⚡ SmartDebugger server starting…")
    print(f"  UI  → http://localhost:{args.port}")
    print(f"  API → http://localhost:{args.port}/dumps\n")

    uvicorn.run(
        "server.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="warning",   # keep stdout clean
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="SmartDebugger Server")
    _add_server_args(parser)
    _run_server(parser.parse_args())


def cli() -> None:
    parser = argparse.ArgumentParser(prog="smartdump", description="SmartDump CLI")
    subparsers = parser.add_subparsers(dest="command")

    start_parser = subparsers.add_parser("start", help="Start the SmartDump server")
    _add_server_args(start_parser)

    args = parser.parse_args()

    if args.command == "start":
        _run_server(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

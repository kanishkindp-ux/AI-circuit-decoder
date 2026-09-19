#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# start_server.sh — Launch the FastAPI dev server (macOS/Linux)
#
# Usage:
#   bash skills/fastapi-dev-runner/scripts/start_server.sh
#   bash skills/fastapi-dev-runner/scripts/start_server.sh --port 8080
#   bash skills/fastapi-dev-runner/scripts/start_server.sh --no-reload
#   bash skills/fastapi-dev-runner/scripts/start_server.sh --port 3001 --no-reload
# ---------------------------------------------------------------------------
set -euo pipefail

PORT=8000
RELOAD="--reload"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --port)
            PORT="$2"
            shift 2
            ;;
        --no-reload)
            RELOAD=""
            shift
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
VENV_PYTHON="$BACKEND_DIR/venv/bin/python"

if [[ ! -f "$VENV_PYTHON" ]]; then
    echo "ERROR: Virtual environment not found at $VENV_PYTHON"
    echo "       Run: python3 -m venv backend/venv"
    exit 1
fi

echo ""
echo "=== FastAPI Dev Runner ==="
echo "  Port   : $PORT"
echo "  Reload : ${RELOAD:+enabled}${RELOAD:-disabled}"
echo "  Dir    : $BACKEND_DIR"
echo "========================="
echo ""

cd "$BACKEND_DIR"
exec "$VENV_PYTHON" -m uvicorn main:app --host 0.0.0.0 --port "$PORT" $RELOAD

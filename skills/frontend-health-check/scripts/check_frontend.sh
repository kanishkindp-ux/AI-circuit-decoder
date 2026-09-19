#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check_frontend.sh — Lint + dry-run build for the React frontend
#
# Usage:
#   bash skills/frontend-health-check/scripts/check_frontend.sh
#   bash skills/frontend-health-check/scripts/check_frontend.sh --lint-only
#   bash skills/frontend-health-check/scripts/check_frontend.sh --build-only
# ---------------------------------------------------------------------------
set -uo pipefail

RUN_LINT=true
RUN_BUILD=true

while [[ $# -gt 0 ]]; do
    case "$1" in
        --lint-only)  RUN_BUILD=false; shift ;;
        --build-only) RUN_LINT=false;  shift ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    echo "ERROR: node_modules not found. Run: cd frontend && npm install"
    exit 1
fi

EXIT_CODE=0

echo ""
echo "=== Frontend Health Check ==="
echo "  Directory: $FRONTEND_DIR"
echo "============================="
echo ""

cd "$FRONTEND_DIR"

# --- Lint ---
if $RUN_LINT; then
    echo "[STEP] Running ESLint..."
    if npm run lint 2>&1; then
        echo "[PASS] Lint — No errors found"
    else
        echo "[FAIL] Lint — ESLint reported violations"
        EXIT_CODE=1
    fi
    echo ""
fi

# --- Build ---
if $RUN_BUILD; then
    echo "[STEP] Running Vite production build..."
    if npm run build 2>&1; then
        echo "[PASS] Build — Production bundle compiled successfully"
        # Clean up
        rm -rf "$FRONTEND_DIR/dist"
        echo "       (cleaned up dist/ — this was a dry-run)"
    else
        echo "[FAIL] Build — Vite build failed"
        EXIT_CODE=1
    fi
    echo ""
fi

echo ""
if [[ $EXIT_CODE -eq 0 ]]; then
    echo "=== RESULT: ALL CHECKS PASSED ==="
else
    echo "=== RESULT: SOME CHECKS FAILED ==="
fi

exit $EXIT_CODE

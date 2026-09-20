#!/usr/bin/env bash
set -euo pipefail

# Run MindForge locally.
# Usage: ./run.sh [desktop|app] [--install]
#
#   desktop      Tauri desktop app (default) — pnpm tauri:dev
#   app          Frontend Vite only — pnpm dev:app
#   --install    Install workspace deps before starting

MODE="desktop"
DO_INSTALL=0

for arg in "$@"; do
  case "$arg" in
    desktop|app)
      MODE="$arg"
      ;;
    --install|-i)
      DO_INSTALL=1
      ;;
    -h|--help)
      sed -n '3,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [desktop|app] [--install]" >&2
      exit 2
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Required command '$name' is not available in PATH." >&2
    exit 3
  fi
}

require_cmd node
require_cmd pnpm

if [[ "$MODE" == "desktop" ]]; then
  require_cmd rustc
  require_cmd cargo
fi

if [[ "$DO_INSTALL" -eq 1 ]] || [[ ! -d node_modules && ! -d frontend_app/node_modules ]]; then
  echo "==> Installing dependencies"
  env CI=true pnpm install
fi

case "$MODE" in
  desktop)
    echo "==> Starting Tauri desktop app (dev)"
    exec pnpm tauri:dev
    ;;
  app)
    echo "==> Starting frontend Vite app"
    exec pnpm dev:app
    ;;
esac

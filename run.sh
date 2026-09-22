#!/usr/bin/env bash
set -euo pipefail

# Run / build MindForge locally.
# Usage:
#   ./run.sh [desktop|app] [--install]
#   ./run.sh build [--detect|--all] [--targets LIST] [--init-mobile] [--dry-run] [--install]
#
#   desktop         Tauri desktop app (default) — pnpm tauri:dev
#   app             Frontend Vite only — pnpm dev:app
#   build           Cross-platform release build via scripts/build/build.mjs
#                     (default: native desktop for this host)
#   build --detect  Probe Xcode / Android SDK·NDK / JDK / Rust / Docker only
#   build --all     Build every target ready on this machine
#   --targets LIST  Comma list: mac,windows,linux,android
#   --init-mobile   Run tauri android init when missing
#   --dry-run       Print build commands without executing
#   --install, -i   Install workspace deps before starting

MODE="desktop"
DO_INSTALL=0
BUILD_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    desktop|app|build)
      MODE="$1"
      shift
      ;;
    --install|-i)
      DO_INSTALL=1
      shift
      ;;
    --detect|-d)
      BUILD_ARGS+=(--detect)
      shift
      ;;
    --all|--all-possible)
      BUILD_ARGS+=(--all-possible)
      shift
      ;;
    --targets|-t)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for $1" >&2
        exit 2
      fi
      BUILD_ARGS+=(--targets "$2")
      shift 2
      ;;
    --targets=*)
      BUILD_ARGS+=(--targets "${1#*=}")
      shift
      ;;
    --init-mobile)
      BUILD_ARGS+=(--init-mobile)
      shift
      ;;
    --dry-run)
      BUILD_ARGS+=(--dry-run)
      shift
      ;;
    --skip-frontend)
      BUILD_ARGS+=(--skip-frontend)
      shift
      ;;
    --fail-fast)
      BUILD_ARGS+=(--fail-fast)
      shift
      ;;
    --json)
      BUILD_ARGS+=(--json)
      shift
      ;;
    -h|--help)
      sed -n '3,18p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [desktop|app|build] [build options…] [--install]" >&2
      echo "Try: $0 --help" >&2
      exit 2
      ;;
  esac
done

if [[ ${#BUILD_ARGS[@]} -gt 0 && "$MODE" != "build" ]]; then
  echo "Build flags require mode 'build' (got: $MODE)" >&2
  exit 2
fi

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

if [[ "$MODE" == "desktop" || "$MODE" == "build" ]]; then
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
  build)
    echo "==> Cross-platform build (scripts/build/build.mjs)"
    if [[ ${#BUILD_ARGS[@]} -eq 0 ]]; then
      exec node scripts/build/build.mjs
    else
      exec node scripts/build/build.mjs "${BUILD_ARGS[@]}"
    fi
    ;;
esac

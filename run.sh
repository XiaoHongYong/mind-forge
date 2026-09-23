#!/usr/bin/env bash
set -euo pipefail

# Run / build MindForge locally.
# Usage:
#   ./run.sh [desktop|app|android] [--install]
#   ./run.sh android [--init-mobile] [--open] [--host [ADDR]] [DEVICE] [-- …]
#   ./run.sh build [--detect|--all] [--targets LIST] [--init-mobile] [--dry-run] [--install]
#
#   desktop         Tauri desktop app (default) — pnpm tauri:dev
#   app             Frontend Vite only — pnpm dev:app
#   android         Tauri Android app (dev) — project @tauri-apps/cli
#                     Needs SDK / NDK / JDK. First time: --init-mobile
#                     Physical device: often need --host (LAN IP for Vite)
#                     Open Android Studio: --open
#   build           Cross-platform release build via scripts/build/build.mjs
#                     (default: native desktop for this host)
#   build --detect  Probe Xcode / Android SDK·NDK / JDK / Rust / Docker only
#   build --all     Build every target ready on this machine
#   --targets LIST  Comma list: mac,windows,linux,android
#   --init-mobile   Run tauri android init when missing (android | build)
#   --dry-run       Print build commands without executing
#   --install, -i   Install workspace deps before starting

MODE="desktop"
DO_INSTALL=0
INIT_MOBILE=0
BUILD_ARGS=()
ANDROID_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    desktop|app|build|android)
      MODE="$1"
      shift
      ;;
    --)
      if [[ "$MODE" != "android" ]]; then
        echo "'--' is only valid with mode 'android'" >&2
        exit 2
      fi
      shift
      ANDROID_ARGS+=("$@")
      break
      ;;
    --install|-i)
      DO_INSTALL=1
      shift
      ;;
    --init-mobile)
      INIT_MOBILE=1
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
      sed -n '3,24p' "$0"
      exit 0
      ;;
    *)
      if [[ "$MODE" == "android" ]]; then
        ANDROID_ARGS+=("$1")
        shift
      else
        echo "Unknown argument: $1" >&2
        echo "Usage: $0 [desktop|app|android|build] [options…] [--install]" >&2
        echo "Try: $0 --help" >&2
        exit 2
      fi
      ;;
  esac
done

if [[ ${#BUILD_ARGS[@]} -gt 0 && "$MODE" != "build" ]]; then
  echo "Build flags require mode 'build' (got: $MODE)" >&2
  exit 2
fi

if [[ "$INIT_MOBILE" -eq 1 && "$MODE" == "build" ]]; then
  BUILD_ARGS+=(--init-mobile)
fi

if [[ "$INIT_MOBILE" -eq 1 && "$MODE" != "build" && "$MODE" != "android" ]]; then
  echo "--init-mobile requires mode 'android' or 'build' (got: $MODE)" >&2
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

if [[ "$MODE" == "desktop" || "$MODE" == "build" || "$MODE" == "android" ]]; then
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
  android)
    echo "==> Preparing Android env (SDK / NDK / JDK)"
    # shellcheck disable=SC1090
    eval "$(node scripts/build/detect-env.mjs --export-android-env)"
    export NDK_HOME="${ANDROID_NDK_HOME:-${NDK_HOME:-}}"

    SRC_TAURI="$ROOT_DIR/desktop/src-tauri"
    TAURI_JS="$ROOT_DIR/frontend_app/node_modules/.bin/tauri"
    if [[ ! -e "$TAURI_JS" ]]; then
      echo "Missing $TAURI_JS — run: pnpm --dir frontend_app install" >&2
      exit 3
    fi

    if [[ ! -d "$SRC_TAURI/gen/android" ]]; then
      if [[ "$INIT_MOBILE" -eq 1 ]]; then
        echo "==> tauri android init"
        (cd "$SRC_TAURI" && npx --prefix "$ROOT_DIR/frontend_app" tauri android init --ci)
      else
        echo "Android project not initialized (missing desktop/src-tauri/gen/android)." >&2
        echo "First time: $0 android --init-mobile" >&2
        echo "Release build: $0 build --targets android --init-mobile" >&2
        exit 1
      fi
    fi

    # Gradle's rust task runs `cargo tauri android android-studio-script`, which
    # WebSockets back to the parent CLI via $TMPDIR/<bundle-id>-server-addr.
    # A stale addr (or mismatched global cargo-tauri vs @tauri-apps/cli) causes
    # "Connection refused". Prefer the project CLI for both parent and shim.
    SHIM_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mindforge-tauri-shim.XXXXXX")"
    cat >"$SHIM_DIR/cargo-tauri" <<EOF
#!/bin/sh
# cargo invokes custom subcommands as: cargo-tauri tauri <args…>
if [ "\$1" = "tauri" ]; then
  shift
fi
exec "$TAURI_JS" "\$@"
EOF
    chmod +x "$SHIM_DIR/cargo-tauri"
    export PATH="$SHIM_DIR:$PATH"

    BUNDLE_ID="$(node -e "const c=require('$SRC_TAURI/tauri.conf.json'); process.stdout.write(c.identifier||'')")"
    if [[ -n "$BUNDLE_ID" ]]; then
      rm -f "${TMPDIR:-/tmp}/${BUNDLE_ID}-server-addr"
    fi

    echo "==> Starting Tauri Android app (dev) [cli $($TAURI_JS --version 2>/dev/null | tr -d '\n')]"
    cd "$SRC_TAURI"
    # bash + set -u: empty "${arr[@]}" is an unbound-variable error
    if [[ ${#ANDROID_ARGS[@]} -gt 0 ]]; then
      echo "    extra args: ${ANDROID_ARGS[*]}"
      exec cargo tauri android dev "${ANDROID_ARGS[@]}"
    else
      exec cargo tauri android dev
    fi
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

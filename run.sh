#!/usr/bin/env bash
set -euo pipefail

# Run / build MindForge locally.
# Usage:
#   ./run.sh [desktop|app|android|ohos] [--install]
#   ./run.sh android [--init-mobile] [--open] [--host [ADDR]] [DEVICE] [-- …]
#   ./run.sh ohos [--sync-only] [--release] [--open] [--deploy] [--run]
#                 [--logs] [--device SN] [--clean]
#   ./run.sh build [--detect|--all] [--targets LIST] [--init-mobile] [--dry-run] [--install]
#
#   desktop         Tauri desktop app (default) — pnpm tauri:dev
#   app             Frontend Vite only — pnpm dev:app
#   android         Tauri Android app (dev) — project @tauri-apps/cli
#                     Needs SDK / NDK / JDK. First time: --init-mobile
#                     Physical device: often need --host (LAN IP for Vite)
#                     Open Android Studio: --open
#   ohos            HarmonyOS NEXT shell (ArkWeb) — ohos/
#                     Default: build frontend + sync bundle + assembleHap
#                     Needs DevEco Studio (it ships the SDK, hvigor and hdc)
#                     --install / --run need a SIGNED HAP: sign once in
#                     DevEco Studio, see ohos/README.md
#   build           Cross-platform release build via scripts/build/build.mjs
#                     (default: native desktop for this host)
#   build --detect  Probe Xcode / Android SDK·NDK / JDK / Rust / Docker / DevEco
#   build --all     Build every target ready on this machine
#   --targets LIST  Comma list: mac,windows,linux,android
#   --init-mobile   Run tauri android init when missing (android | build)
#   --dry-run       Print build commands without executing
#   --install, -i   Install workspace deps before starting (all modes)
#
# ohos options:
#   --sync-only     Stop after rebuilding the bundle into rawfile (no hvigor)
#   --release       Assemble with buildMode=release instead of debug
#   --open          Open ohos/ in DevEco Studio
#   --deploy        Install the *signed* HAP to the connected device (hdc)
#   --run           Deploy, then start EntryAbility
#   --logs          Stream hilog filtered to MindForge.Diagnostics
#   --device SN     Target device serial, for --deploy / --run / --logs
#   --clean         Remove ohos build outputs and exit
#
# --install stays what it always was (pnpm install, any mode). Pushing the app
# to a device is --deploy, so the two never mean different things depending on
# where the flag sits.

MODE="desktop"
DO_INSTALL=0
INIT_MOBILE=0
BUILD_ARGS=()
ANDROID_ARGS=()
OHOS_SYNC_ONLY=0
OHOS_RELEASE=0
OHOS_OPEN=0
OHOS_DEPLOY=0
OHOS_RUN=0
OHOS_LOGS=0
OHOS_CLEAN=0
OHOS_DEVICE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    desktop|app|build|android|ohos)
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
    # Flags that mean something to both android (passed through to
    # `cargo tauri android dev`) and ohos (handled here). Dispatch on MODE so
    # adding an ohos flag cannot quietly stop `./run.sh android --open` working.
    --sync-only|--release|--open|--deploy|--run|--logs|--clean)
      if [[ "$MODE" == "android" ]]; then
        ANDROID_ARGS+=("$1")
      elif [[ "$MODE" == "ohos" ]]; then
        case "$1" in
          --sync-only) OHOS_SYNC_ONLY=1 ;;
          --release)   OHOS_RELEASE=1 ;;
          --open)      OHOS_OPEN=1 ;;
          --deploy)    OHOS_DEPLOY=1 ;;
          --run)       OHOS_RUN=1 ;;
          --logs)      OHOS_LOGS=1 ;;
          --clean)     OHOS_CLEAN=1 ;;
        esac
      else
        echo "$1 requires mode 'ohos' or 'android' (got: $MODE)" >&2
        exit 2
      fi
      shift
      ;;
    --device)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for $1" >&2
        exit 2
      fi
      OHOS_DEVICE="$2"
      shift 2
      ;;
    --device=*)
      OHOS_DEVICE="${1#*=}"
      shift
      ;;
    -h|--help)
      # Print the leading comment block: comment lines after the shebang, up to
      # the first line of code. Blank lines inside the block are skipped, and
      # the "first line of code" test ignores whitespace so an indented first
      # statement still ends it. Range-free, so editing the block cannot leave
      # --help truncated the way a hardcoded `sed -n '3,24p'` would.
      awk 'NR>2 { if (/^#/) print; else if ($0 !~ /^[[:space:]]*$/) exit }' "$0"
      exit 0
      ;;
    *)
      if [[ "$MODE" == "android" ]]; then
        ANDROID_ARGS+=("$1")
        shift
      else
        echo "Unknown argument: $1" >&2
        echo "Usage: $0 [desktop|app|android|ohos|build] [options…] [--install]" >&2
        echo "Try: $0 --help" >&2
        exit 2
      fi
      ;;
  esac
done

if [[ "$MODE" != "ohos" && -n "$OHOS_DEVICE" ]]; then
  echo "--device requires mode 'ohos' (got: $MODE)" >&2
  exit 2
fi

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
  ohos)
    echo "==> Preparing HarmonyOS env (SDK / hvigor / hdc from DevEco Studio)"
    # shellcheck disable=SC1090
    eval "$(node scripts/build/detect-env.mjs --export-ohos-env)"

    HVIGORW="${OHOS_HVIGORW:?hvigorw not found — install DevEco Studio or set DEVECO_STUDIO_HOME}"
    BUNDLE_NAME="${OHOS_BUNDLE_NAME:-com.crintsoft.mindforge}"
    OUT_DIR="$ROOT_DIR/ohos/entry/build/default/outputs/default"

    if [[ "$OHOS_CLEAN" -eq 1 ]]; then
      echo "==> Removing ohos build outputs"
      rm -rf "$ROOT_DIR/ohos/entry/build" \
             "$ROOT_DIR/ohos/entry/.preview" \
             "$ROOT_DIR/ohos/.hvigor" \
             "$ROOT_DIR/ohos/build"
      echo "Done. (rawfile/www left in place — rebuild it with --sync-only)"
      exit 0
    fi

    if [[ "$OHOS_OPEN" -eq 1 ]]; then
      if [[ "$(uname -s)" == "Darwin" ]]; then
        open -a "${DEVECO_STUDIO_HOME:-/Applications/DevEco-Studio.app}" "$ROOT_DIR/ohos"
      else
        echo "Open this folder in DevEco Studio: $ROOT_DIR/ohos"
      fi
    fi

    # `hdc` reaches the exported PATH above, so this is a real binary by now.
    hdc_cmd() {
      if [[ -n "$OHOS_DEVICE" ]]; then
        hdc -t "$OHOS_DEVICE" "$@"
      else
        hdc "$@"
      fi
    }

    if [[ "$OHOS_LOGS" -eq 1 ]]; then
      echo "==> Streaming hilog (Ctrl-C to stop) — tag MindForge.Diagnostics"
      echo "    Also useful: any MindForge.* tag is this app."
      # Not `exec`: this is a pipeline, and exec cannot replace one. The
      # line-buffered grep keeps output live rather than block-buffered.
      hdc_cmd shell hilog | grep --line-buffered -E "MindForge\."
      exit 0
    fi

    echo "==> Building frontend + syncing bundle into rawfile"
    pnpm build:ohos

    if [[ "$OHOS_SYNC_ONLY" -eq 1 ]]; then
      echo "==> Stopping before hvigor (--sync-only)."
      echo "    Assemble in DevEco Studio, or re-run without --sync-only."
      exit 0
    fi

    BUILD_MODE="debug"
    if [[ "$OHOS_RELEASE" -eq 1 ]]; then
      BUILD_MODE="release"
    fi

    # Before hvigor, not after: with -enable-property-obfuscation a method that
    # fell out of obfuscation-rules.txt is removed silently, so the build would
    # otherwise succeed and ship a bridge missing a method. Fails the script.
    echo "==> Checking bridge names survive obfuscation"
    node scripts/build/check-ohos-bridge.mjs

    # Also before hvigor, because hvigor's own signing errors point at the wrong
    # thing ("no signature file" / "check the keyAlias"). This names the actual
    # broken link. Exits 0 when signing is simply not configured.
    echo "==> Checking signing configuration"
    node scripts/build/check-ohos-signing.mjs

    echo "==> Assembling HAP (buildMode=$BUILD_MODE)"
    # --no-daemon on purpose: the daemon caches DEVECO_SDK_HOME from whenever it
    # first started, so pointing the shell at a different SDK would otherwise
    # fail with a stale-path error that looks like a config bug.
    (cd "$ROOT_DIR/ohos" && "$HVIGORW" \
      --mode module -p product=default -p "buildMode=$BUILD_MODE" \
      assembleHap --no-daemon)

    SIGNED="$OUT_DIR/entry-default-signed.hap"
    UNSIGNED="$OUT_DIR/entry-default-unsigned.hap"

    if [[ "$OHOS_DEPLOY" -eq 1 || "$OHOS_RUN" -eq 1 ]]; then
      if [[ ! -f "$SIGNED" ]]; then
        echo "" >&2
        echo "No signed HAP at $SIGNED" >&2
        echo "" >&2
        echo "The HAP builds fine but cannot be installed unsigned. Signing needs a" >&2
        echo "Huawei account and cannot be done from this script:" >&2
        echo "" >&2
        echo "  1. Open $ROOT_DIR/ohos in DevEco Studio" >&2
        echo "  2. Sign in (File > Project Structure > Signing Configs)" >&2
        echo "  3. Tick 'Automatically generate signature' for $BUNDLE_NAME" >&2
        echo "  4. Run once from the IDE — it writes $SIGNED" >&2
        echo "" >&2
        echo "Then re-run this command. See ohos/README.md." >&2
        exit 1
      fi

      echo "==> Deploying to device"
      hdc_cmd install -r "$SIGNED"

      if [[ "$OHOS_RUN" -eq 1 ]]; then
        echo "==> Starting $BUNDLE_NAME/EntryAbility"
        hdc_cmd shell aa start -a EntryAbility -b "$BUNDLE_NAME"
        echo ""
        echo "Logs: $0 ohos --logs"
      fi
      exit 0
    fi

    echo ""
    if [[ -f "$SIGNED" ]]; then
      echo "Signed HAP:   $SIGNED"
      echo ""
      echo "Next: $0 ohos --run          # install + start on the connected device"
    else
      echo "Unsigned HAP: $UNSIGNED"
      echo ""
      echo "Runnable locally, but not installable: signing is not configured."
      echo "Open $ROOT_DIR/ohos in DevEco Studio and sign in once — see ohos/README.md."
      echo "After that, $0 ohos --run installs and starts it."
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

#!/usr/bin/env bash
set -euo pipefail

if (( $# == 0 )); then
  echo "Usage: $(basename "$0") <detox-configuration> [detox-args...]" >&2
  exit 2
fi

PROJECT_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
CONFIGURATION=$1
shift
METRO_PID=""
METRO_LOG=""

metro_running() {
  curl --fail --silent --max-time 1 http://127.0.0.1:8081/status 2>/dev/null \
    | grep -q '^packager-status:running$'
}

configure_connected_devices() {
  local serial
  local state

  while read -r serial state; do
    if [[ "$state" == "device" ]]; then
      adb -s "$serial" shell settings put secure immersive_mode_confirmations confirmed
    fi
  done < <(adb devices)
}

cleanup() {
  if [[ -n "$METRO_PID" ]]; then
    kill -TERM -- "-$METRO_PID" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 -- "-$METRO_PID" 2>/dev/null || break
      sleep 0.1
    done
    kill -KILL -- "-$METRO_PID" 2>/dev/null || true
  fi
  if [[ -n "$METRO_LOG" ]]; then
    rm -f "$METRO_LOG"
  fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! metro_running; then
  METRO_LOG=$(mktemp "${TMPDIR:-/tmp}/laimelea-metro.XXXXXX.log")
  (
    cd "$PROJECT_ROOT"
    exec setsid pnpm start -- --port 8081
  ) >"$METRO_LOG" 2>&1 &
  METRO_PID=$!

  for _ in $(seq 1 60); do
    if metro_running; then
      break
    fi
    if ! kill -0 "$METRO_PID" 2>/dev/null; then
      wait "$METRO_PID" || true
      tail -100 "$METRO_LOG" >&2
      exit 1
    fi
    sleep 1
  done

  if ! metro_running; then
    echo "Metro did not start on port 8081 within 60 seconds." >&2
    tail -100 "$METRO_LOG" >&2
    exit 1
  fi
fi

configure_connected_devices

cd "$PROJECT_ROOT"
pnpm exec detox test --configuration "$CONFIGURATION" "$@"

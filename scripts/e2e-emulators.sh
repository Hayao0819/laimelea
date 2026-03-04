#!/usr/bin/env bash
# E2E emulator pool manager
# Starts/stops headless emulators on dedicated ports (5580-5598)
# for parallel Detox test execution. Does NOT touch existing emulators.
set -euo pipefail

AVD_NAME="Pixel_API_36"
PORT_BASE=5580
PORT_MAX=5598
BOOT_TIMEOUT=120

# Emulator flags for headless CI/test operation
EMU_FLAGS=(
  -read-only
  -no-snapshot
  -no-window
  -no-audio
  -no-boot-anim
  -gpu swiftshader_indirect
  -memory 2048
)

usage() {
  cat <<EOF
Usage: $(basename "$0") <command> [args]

Commands:
  start [N]   Start N emulators (default: 3, max: 10)
  stop        Stop all E2E emulators (ports $PORT_BASE-$PORT_MAX)
  status      Show running E2E emulators and boot state
EOF
}

check_prerequisites() {
  if ! command -v emulator &>/dev/null; then
    echo "ERROR: 'emulator' not found. Run inside 'nix develop'." >&2
    exit 1
  fi
  if ! command -v adb &>/dev/null; then
    echo "ERROR: 'adb' not found. Run inside 'nix develop'." >&2
    exit 1
  fi
  if ! emulator -list-avds 2>/dev/null | grep -q "^${AVD_NAME}$"; then
    echo "ERROR: AVD '${AVD_NAME}' not found. Create it first." >&2
    echo "Available AVDs:" >&2
    emulator -list-avds 2>/dev/null >&2
    exit 1
  fi
  if [[ -e /dev/kvm ]]; then
    if [[ ! -r /dev/kvm || ! -w /dev/kvm ]]; then
      echo "WARNING: /dev/kvm exists but is not readable/writable. Emulators will be slow." >&2
    fi
  else
    echo "WARNING: /dev/kvm not found. Hardware acceleration unavailable." >&2
  fi
}

wait_for_boot() {
  local serial="$1"
  local elapsed=0
  echo -n "  Waiting for $serial to boot..."
  while (( elapsed < BOOT_TIMEOUT )); do
    local status
    status=$(adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
    if [[ "$status" == "1" ]]; then
      echo " ready (${elapsed}s)"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo " TIMEOUT (${BOOT_TIMEOUT}s)" >&2
  return 1
}

cmd_start() {
  local count="${1:-3}"
  if (( count < 1 || count > 10 )); then
    echo "ERROR: Count must be 1-10 (got $count)" >&2
    exit 1
  fi

  check_prerequisites

  echo "Starting $count E2E emulator(s)..."
  local pids=()
  local serials=()
  local port=$PORT_BASE

  for (( i = 0; i < count; i++ )); do
    if (( port > PORT_MAX )); then
      echo "ERROR: Port limit exceeded ($PORT_MAX). Max 10 emulators." >&2
      exit 1
    fi
    local serial="emulator-${port}"

    # Check if port is already in use
    if adb devices 2>/dev/null | grep -q "^${serial}"; then
      echo "  $serial already running, skipping"
      serials+=("$serial")
      port=$((port + 2))
      continue
    fi

    echo "  Launching $serial (port $port)..."
    emulator -avd "$AVD_NAME" -port "$port" "${EMU_FLAGS[@]}" &>/dev/null &
    pids+=($!)
    serials+=("$serial")
    port=$((port + 2))
  done

  # Wait for all emulators to boot
  local failed=0
  for serial in "${serials[@]}"; do
    # Give adb a moment to see the new device
    sleep 1
    if ! wait_for_boot "$serial"; then
      echo "WARNING: $serial failed to boot within ${BOOT_TIMEOUT}s" >&2
      failed=$((failed + 1))
    fi
  done

  local booted=$(( ${#serials[@]} - failed ))
  echo ""
  echo "E2E pool: $booted/${#serials[@]} emulator(s) ready"
  if (( failed > 0 )); then
    exit 1
  fi
}

cmd_stop() {
  echo "Stopping E2E emulators (ports $PORT_BASE-$PORT_MAX)..."
  local stopped=0
  local port=$PORT_BASE
  while (( port <= PORT_MAX )); do
    local serial="emulator-${port}"
    if adb devices 2>/dev/null | grep -q "^${serial}"; then
      echo "  Stopping $serial..."
      adb -s "$serial" emu kill &>/dev/null || true
      stopped=$((stopped + 1))
    fi
    port=$((port + 2))
  done
  if (( stopped == 0 )); then
    echo "  No E2E emulators running"
  else
    echo "  Stopped $stopped emulator(s)"
  fi
}

cmd_status() {
  echo "E2E emulator pool (ports $PORT_BASE-$PORT_MAX):"
  local found=0
  local port=$PORT_BASE
  while (( port <= PORT_MAX )); do
    local serial="emulator-${port}"
    if adb devices 2>/dev/null | grep -q "^${serial}"; then
      local boot_status
      boot_status=$(adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || echo "unknown")
      echo "  $serial  boot_completed=$boot_status"
      found=$((found + 1))
    fi
    port=$((port + 2))
  done
  if (( found == 0 )); then
    echo "  (none running)"
  else
    echo ""
    echo "Total: $found emulator(s)"
  fi
}

case "${1:-}" in
  start)  cmd_start "${2:-3}" ;;
  stop)   cmd_stop ;;
  status) cmd_status ;;
  *)      usage; exit 1 ;;
esac

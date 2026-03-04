# Parallel E2E Testing

LLM 向け並列 E2E テスト実行ガイド。

## Architecture

```text
┌──────────────────────────────────────────────────┐
│  scripts/e2e-emulators.sh start N                │
│                                                  │
│   emulator-5580  emulator-5582  emulator-5584    │
│   (headless)     (headless)     (headless)       │
└──────────┬───────────┬───────────┬───────────────┘
           │           │           │
           ▼           ▼           ▼
┌──────────────────────────────────────────────────┐
│  Detox --configuration android.e2e.debug         │
│  --maxWorkers=3                                  │
│                                                  │
│  Jest Worker 1   Jest Worker 2   Jest Worker 3   │
│  clock.e2e.ts    alarm.e2e.ts    timer.e2e.ts    │
└──────────────────────────────────────────────────┘
```

## Components

| Component           | File                                | Role                                                                 |
| ------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| Emulator manager    | `scripts/e2e-emulators.sh`          | start/stop/status for E2E pool                                       |
| Detox device config | `.detoxrc.js` (`e2e-pool`)          | `android.attached` + regex `emulator-558[0-9]`                       |
| Detox configuration | `.detoxrc.js` (`android.e2e.debug`) | Binds `e2e-pool` device to `android.debug` app                       |
| npm scripts         | `package.json`                      | `e2e:pool:start`, `e2e:pool:stop`, `e2e:pool:status`, `e2e:parallel` |

## Port Design

- **E2E pool**: ports 5580, 5582, 5584, ..., 5598 (even numbers, max 10 emulators)
- **Existing emulators**: ports 5554, 5556, etc. (standard ADB range)
- **No conflict**: The regex `emulator-558[0-9]` only matches E2E pool devices
- Detox's `android.attached` type connects to already-running emulators by ADB name

## Usage

### Step 1 - Start emulator pool

```bash
./scripts/e2e-emulators.sh start 3
```

Launches 3 headless emulators on ports 5580, 5582, 5584. Waits for `sys.boot_completed == 1` on each (timeout: 120s).

### Step 2 - Run tests in parallel

```bash
pnpm detox test --configuration android.e2e.debug --maxWorkers=3
```

Detox distributes test files across Jest workers. Each worker gets one emulator from the pool.

### Step 3 - Stop emulator pool

```bash
./scripts/e2e-emulators.sh stop
```

Kills only E2E emulators (ports 5580-5598). Existing emulators on 5554 etc. are untouched.

### One-liner

```bash
./scripts/e2e-emulators.sh start 3 && pnpm e2e:parallel; ./scripts/e2e-emulators.sh stop
```

### Using npm scripts

```bash
pnpm e2e:pool:start    # Start 3 emulators
pnpm e2e:parallel      # Run tests with maxWorkers=3
pnpm e2e:pool:stop     # Stop pool
```

## Choosing emulator count

| Emulators | RAM (approx) | Best for                             |
| --------- | ------------ | ------------------------------------ |
| 1         | ~2 GB        | Minimal / CI with limited resources  |
| 2         | ~4 GB        | Small test suites                    |
| 3         | ~6 GB        | Default, good balance                |
| 4-5       | ~8-10 GB     | Large test suites on 16+ GB machines |

Each emulator uses `-memory 2048` (2 GB). Add ~500 MB overhead per instance for host processes.

## Troubleshooting

### KVM not available

```text
WARNING: /dev/kvm not found. Hardware acceleration unavailable.
```

Emulators will run with software rendering (`swiftshader_indirect`) but boot slowly. On Linux, ensure KVM module is loaded: `modprobe kvm_intel` or `modprobe kvm_amd`.

### Emulator fails to boot

- Check AVD exists: `emulator -list-avds` should show `Pixel_API_36`
- Increase timeout: edit `BOOT_TIMEOUT` in `scripts/e2e-emulators.sh`
- Check logs: `adb -s emulator-5580 logcat -d | tail -50`

### ADB doesn't see emulators

```bash
adb kill-server && adb start-server
./scripts/e2e-emulators.sh status
```

### Detox can't find devices

- Verify emulators are booted: `./scripts/e2e-emulators.sh status`
- Verify configuration: `pnpm detox test --configuration android.e2e.debug --list-devices`
- Ensure APK is built: `pnpm e2e:build`

### Port conflict

If ports 5580-5598 are in use by other processes, stop them first or adjust `PORT_BASE` in the script.

## Compatibility with existing workflow

The parallel system is **additive** and does not change existing configurations:

- `android.emu.debug` still works for single-emulator testing via `emulator` device
- `android.att.debug` still matches any attached device
- `android.e2e.debug` is a new configuration that only targets the E2E pool

## LLM integration

When running E2E tests, **always use the parallel pool** unless explicitly told otherwise:

1. Build the APK if needed: `pnpm e2e:build`
2. Start the pool: `./scripts/e2e-emulators.sh start 3`
3. Run tests: `pnpm e2e:parallel`
4. Stop the pool: `./scripts/e2e-emulators.sh stop`

For single-file debugging, use `--maxWorkers=1`:

```bash
pnpm detox test --configuration android.e2e.debug --maxWorkers=1 __tests__/e2e/clock.e2e.ts
```

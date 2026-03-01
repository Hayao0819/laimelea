# Nix Dev Environment

## Overview

This project uses Nix flakes to provide a reproducible development environment with:

- **Node.js 22** - JavaScript runtime
- **pnpm** - Package manager
- **JDK 17** - Java Development Kit (for Android/Gradle)
- **Android SDK 36** - Build tools, platform tools, NDK, emulator
- **nixfmt** - Nix formatter (RFC style)
- **watchman** - File watcher for React Native

## Prerequisites

1. [Nix package manager](https://nixos.org/download/) installed
2. Flakes enabled (add `experimental-features = nix-command flakes` to `~/.config/nix/nix.conf`)
3. (Optional) [direnv](https://direnv.net/) for automatic shell activation

## Quick Start

```bash
# Enter dev shell
nix develop

# Or with direnv (auto-activates on cd)
direnv allow
```

## Environment Variables

These are set automatically when entering the Nix dev shell:

| Variable           | Value                              | Purpose                                                 |
| ------------------ | ---------------------------------- | ------------------------------------------------------- |
| `ANDROID_HOME`     | `<android-sdk>/share/android-sdk`  | Android SDK root                                        |
| `ANDROID_SDK_ROOT` | Same as ANDROID_HOME               | Legacy alias                                            |
| `ANDROID_NDK_ROOT` | `<ANDROID_HOME>/ndk/27.1.12297006` | NDK path                                                |
| `JAVA_HOME`        | `<jdk17>`                          | Java 17                                                 |
| `GRADLE_OPTS`      | aapt2 override                     | Use Nix-provided aapt2 instead of Gradle-downloaded one |

## Android SDK Components

Managed by [android-nixpkgs](https://github.com/tadfisher/android-nixpkgs) (daily CI updates):

| Component              | Version       | Matching `build.gradle`        |
| ---------------------- | ------------- | ------------------------------ |
| `platforms-android-36` | API 36        | `compileSdkVersion = 36`       |
| `build-tools-36-0-0`   | 36.0.0        | `buildToolsVersion = "36.0.0"` |
| `ndk-27-1-12297006`    | 27.1.12297006 | `ndkVersion = "27.1.12297006"` |
| `platform-tools`       | latest        | `adb`, `fastboot`              |
| `cmdline-tools-latest` | latest        | `sdkmanager`, `avdmanager`     |
| `emulator`             | latest        | Android emulator               |

## Adding/Updating SDK Components

Edit `flake.nix` and add packages to the `androidSdk` definition:

```nix
androidSdk = android-nixpkgs.sdk.${system} (
  sdkPkgs: with sdkPkgs; [
    cmdline-tools-latest
    platform-tools
    build-tools-36-0-0
    platforms-android-36
    ndk-27-1-12297006
    emulator
    # Add new components here, e.g.:
    # system-images-android-36-google-apis-x86-64
  ]
);
```

Then run:

```bash
nix flake lock --update-input android-nixpkgs
nix develop
```

## Emulator Setup

```bash
# List available system images
sdkmanager --list | grep system-images

# Create AVD (after adding system image to flake.nix)
avdmanager create avd --force --name pixel --package 'system-images;android-36;google_apis;x86_64'

# Launch emulator
emulator -avd pixel
```

## Validation

### Quick Check

```bash
nix flake check
```

### Full Validation

```bash
# 1. Nix flake syntax check
nix flake check --show-trace

# 2. Verify dev shell evaluates
nix develop --command echo "Shell OK"

# 3. Run project tests
pnpm jest --no-coverage

# 4. TypeScript type check
pnpm tsc --noEmit

# 5. Lint
pnpm eslint .
```

### When to Run

- **After any `.nix` file edit**: `nix flake check`
- **After any `.ts`/`.tsx` edit**: `pnpm jest` + `pnpm tsc --noEmit`
- **Before commits**: All of the above
- **After adding/removing packages**: `pnpm install` + `nix flake check`

### Format Before Commit

```bash
# Format all files (Nix + TypeScript + JSON + Markdown)
treefmt
```

### Android Build Validation

```bash
# Enter dev shell first
nix develop

# Verify Android SDK
echo $ANDROID_HOME
adb --version

# Build debug APK
cd android && ./gradlew assembleDebug
```

## Troubleshooting

### `nix develop` is slow on first run

First run downloads all packages. Subsequent runs use cache.

```bash
# Check what will be downloaded
nix develop --dry-run
```

### `nix develop` fails with missing SDK package

android-nixpkgs tracks upstream daily. If a very new version isn't available yet:

```bash
# Check available packages
nix flake show github:tadfisher/android-nixpkgs/stable --json 2>/dev/null | head
```

### Package not found in android-nixpkgs

```bash
# List available SDK packages
nix develop --command sdkmanager --list 2>/dev/null | grep -i "build-tools"
```

### Infinite recursion in .nix files

**Causes:**

- Circular references
- Missing `mkIf` for conditional config

**Fix:**

```nix
# Always use let...in instead of rec
let
  a = 1;
in {
  inherit a;
  b = a + 2;
}
```

### Gradle build fails with aapt2 error

The Nix-provided aapt2 is used via `GRADLE_OPTS`. If it fails:

```bash
# Verify the path exists
ls -la $ANDROID_HOME/build-tools/36.0.0/aapt2

# Temporarily disable override to test
unset GRADLE_OPTS
cd android && ./gradlew assembleDebug
```

### Node.js / pnpm not found after shell exit

Tools are only available inside the Nix dev shell:

```bash
# Re-enter shell
nix develop

# Or use direnv for automatic activation
echo "use flake" > .envrc
direnv allow
```

### Node.js version mismatch

The Nix shell provides Node.js 22. If you need a different version, edit `flake.nix`:

```nix
# Change nodejs_22 to nodejs_20, nodejs_21, etc.
nodejs_22
```

### Debug Commands

```bash
# Show detailed traces
nix flake check --show-trace

# Force re-evaluate (bypass cache)
nix develop --refresh

# Show flake structure
nix flake show

# Update specific input
nix flake lock --update-input android-nixpkgs

# Update all inputs
nix flake update

# Garbage collect old derivations
nix-collect-garbage -d
```

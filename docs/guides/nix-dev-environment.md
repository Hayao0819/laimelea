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

## Environment Variables Set Automatically

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

## Troubleshooting

### `nix develop` fails with missing SDK package

android-nixpkgs tracks upstream daily. If a very new version isn't available yet:

```bash
# Check available packages
nix flake show github:tadfisher/android-nixpkgs/stable --json 2>/dev/null | head
```

### Gradle can't find aapt2

The `GRADLE_OPTS` env var overrides Gradle's aapt2 with the Nix-provided one. If issues persist, check:

```bash
echo $GRADLE_OPTS
ls $ANDROID_HOME/build-tools/36.0.0/aapt2
```

### Node.js version mismatch

The Nix shell provides Node.js 22. If you need a different version, edit `flake.nix`:

```nix
# Change nodejs_22 to nodejs_20, nodejs_21, etc.
nodejs_22
```

# Validation Guide

## Quick Check

```bash
nix flake check
```

## Full Validation

```bash
# 1. Nix flake syntax check
nix flake check --show-trace

# 2. Verify dev shell evaluates
nix develop --command echo "Shell OK"

# 3. Run project tests
npx jest --no-coverage

# 4. TypeScript type check
npx tsc --noEmit

# 5. Lint
npx eslint .
```

## When to Run

- **After any `.nix` file edit**: `nix flake check`
- **After any `.ts`/`.tsx` edit**: `npx jest` + `npx tsc --noEmit`
- **Before commits**: All of the above
- **After adding/removing packages**: `pnpm install` + `nix flake check`

## Format Before Commit

```bash
# Format all files (Nix + TypeScript + JSON + Markdown)
treefmt
```

## Android Build Validation

```bash
# Enter dev shell first
nix develop

# Verify Android SDK
echo $ANDROID_HOME
adb --version

# Build debug APK
cd android && ./gradlew assembleDebug
```

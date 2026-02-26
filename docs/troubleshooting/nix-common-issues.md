# Nix Troubleshooting

## Common Issues

### `nix develop` is slow on first run

First run downloads all packages. Subsequent runs use cache.

```bash
# Check what will be downloaded
nix develop --dry-run
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

## Debug Commands

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

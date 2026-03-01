# Nix Language Quick Reference

## Core Concepts

- **Purely functional**: No side effects
- **Lazy evaluation**: Only evaluates what's needed
- **Domain-specific**: Designed for package/system configuration

## Essential Syntax

### inherit

```nix
# Copies variables from scope
inherit (lib) mkIf mkOption types;
# Same as: mkIf = lib.mkIf; mkOption = lib.mkOption; types = lib.types;
```

### Functions

```nix
# Single argument (use attrs for multiple)
myFunc = { name, version ? "1.0" }: "${name}-${version}";
myFunc { name = "hello"; }  # Call
```

### Attribute Sets

```nix
{
  name = "pkg";
  meta.description = "desc";  # Nested
}
```

### let ... in

```nix
let
  x = 1;
  y = 2;
in
x + y  # => 3
```

## Flake Structure

```nix
{
  description = "My project";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
    in {
      devShells.x86_64-linux.default = pkgs.mkShell {
        buildInputs = [ pkgs.nodejs ];
      };
    };
}
```

## Common Anti-Patterns

| Bad                   | Good                                | Reason                             |
| --------------------- | ----------------------------------- | ---------------------------------- |
| `rec { a=1; b=a+2; }` | `let a=1; in { inherit a; b=a+2; }` | `rec` risks infinite recursion     |
| `import <nixpkgs> {}` | `inputs.nixpkgs.legacyPackages`     | Lookup paths break reproducibility |
| `url = https://...;`  | `url = "https://...";`              | Bare URLs deprecated (RFC 45)      |

## Key lib Functions

- `mkIf`: Conditional config (prevents recursion)
- `mkOption`: Declare options
- `mkDefault` / `mkForce`: Priority control
- `mkMerge`: Merge attribute sets
- `genAttrs`: Generate attrset from list

## Common Types

- Basic: `bool`, `int`, `str`, `path`
- Containers: `listOf`, `attrsOf`, `submodule`
- Special: `package`, `nullOr`, `either`

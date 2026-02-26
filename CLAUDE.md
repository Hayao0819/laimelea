# CLAUDE.md

AI assistant guidance for Laimelea project.

## Quick Links

### Setup & Validation

- [Architecture](docs/architecture.md) - Full design doc, data models, implementation phases
- [Validation Guide](docs/setup/validation.md) - **ALWAYS validate after .nix changes**

### Guides

- [Nix Dev Environment](docs/guides/nix-dev-environment.md) - `nix develop` setup
- [Nix Language](docs/guides/nix-language.md) - Language quick reference
- [Nix Troubleshooting](docs/troubleshooting/nix-common-issues.md) - Debug commands & fixes

## Essential Rules

1. **Development environment**: Always use `nix develop` (or direnv) for a reproducible environment with Node.js, pnpm, JDK 17, and Android SDK
2. **ALWAYS format with treefmt** before committing or after any file change. treefmt runs Prettier (JS/TS/JSON/MD/YAML) and nixfmt (Nix) in one command. **Never run prettier or nixfmt directly** — always use treefmt:

   ```bash
   treefmt
   ```

3. **Lint** with ESLint (separate from treefmt, as ESLint is a linter not a formatter):

   ```bash
   pnpm eslint .
   ```

4. **ALWAYS validate** after any `.nix` file change:

   ```bash
   nix flake check
   ```

5. **Run tests** after code changes:

   ```bash
   pnpm jest
   ```

6. **Package manager**: pnpm (with `node-linker=hoisted` in `.npmrc` for Metro compatibility). Always use `pnpm` instead of `npm` or `npx`.
7. **Test execution**: Use `pnpm jest <path>` directly, not `pnpm test -- --testPathPattern`

## Project Overview

- **App**: Laimelea - Android clock app with custom day cycle (e.g., 26h)
- **Stack**: React Native 0.84 CLI + TypeScript, New Architecture
- **UI**: react-native-paper v5 (MD3)
- **State**: Jotai v2 with AsyncStorage persistence
- **Navigation**: React Navigation 7
- **Alarms**: @notifee/react-native (AOSP AlarmManager, NO GMS dependency)
- **Testing**: Jest + @testing-library/react-native v13 (async API)

## Android Build Clean

`./gradlew clean` は `build/generated/` を完全に削除しない。namespace やapplicationId を変更した場合、自動生成コードに旧パッケージ名が残りビルドエラーになる。確実にクリーンするには `nix develop` 環境下で以下を実行:

```bash
rm -rf android/app/build android/build android/.gradle
```

その後 `./gradlew assembleDebug` でフルリビルドする。

## Formatting (treefmt)

- **Configuration**: `treefmt.nix` (Nix module, NOT treefmt.toml). Managed by [treefmt-nix](https://github.com/numtide/treefmt-nix)
- **Formatters included**: Prettier (JS/TS/JSX/TSX/JSON/MD/YAML) + nixfmt (Nix)
- **ESLint**: NOT included in treefmt (linter, not formatter). Run separately with `pnpm eslint .`
- **VSCode**: treefmt-vscode extension auto-formats on save via direnv environment
- **CI check**: `nix flake check` validates all files are formatted
- **`nix fmt`**: Also runs treefmt (works outside `nix develop`)

## Nix Anti-Patterns to Avoid

- Avoid `rec { }` → use `let ... in` instead
- Avoid top-level `with` statements
- Avoid lookup paths `<...>` → use flake inputs
- Always quote URLs (RFC 45)

## Emulator操作

エミュレータの操作（スクリーンショット取得、UI要素のタップ、画面遷移の確認など）は**常にサブエージェント（`emulator-operator`）に委譲**すること。MCP toolの呼び出し（`mobile_take_screenshot`, `mobile_list_elements_on_screen` 等）は1回あたりのレスポンスが大きく、メインコンテキストを大量に消費するため、直接呼び出してはならない。

```
Task tool → subagent_type: "emulator-operator"
```

## Auto-Update Policy

When discovering new Nix information through web searches or problem-solving, automatically update relevant documentation files without being asked.

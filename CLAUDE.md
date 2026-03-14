# CLAUDE.md

AI assistant guidance for Laimelea project.

## Quick Links

### Setup & Validation

- [Architecture](docs/architecture.md) - Full design doc, data models, implementation phases
- [Nix Environment](docs/setup/nix-environment.md) - Dev setup, validation, troubleshooting

### Guides

- [Nix Language](docs/llm/nix-language.md) - Language quick reference
- [Unit Testing](docs/llm/testing.md) - React 19 + RNTL v13 act() patterns, Jotai atomWithStorage mocking
- [Parallel E2E Testing](docs/llm/parallel-e2e.md) - Parallel emulator pool for Detox

## Essential Rules

1. **Development environment**: **すべてのコマンドは必ず `nix develop` シェル内で実行すること**（direnv が有効なら自動適用）。`nix develop` 外ではツールバージョンが異なり、CI と結果が一致しない。`nix develop` に入っていない場合は `nix develop --command <cmd>` でラップすること
2. **Lint** with ESLint. Fix any errors before proceeding:

   ```bash
   pnpm eslint .
   ```

3. **Type-check** with TypeScript compiler (catches type errors that ESLint misses):

   ```bash
   pnpm tsc --noEmit
   ```

4. **Run tests** after code changes:

   ```bash
   pnpm jest
   ```

5. **ALWAYS format with treefmt as the final step before committing**. treefmt runs Prettier (JS/TS/JSON/MD/YAML) and nixfmt (Nix) in one command. **Never run prettier or nixfmt directly** — always use treefmt. This MUST run after all code modifications (including eslint fixes) to ensure nothing is committed unformatted:

   ```bash
   treefmt
   ```

6. **Validate Nix** after any `.nix` file change:

   ```bash
   nix flake check
   ```

7. **Package manager**: pnpm (with `node-linker=hoisted` in `.npmrc` for Metro compatibility). Always use `pnpm` instead of `npm` or `npx`.
8. **Test execution**: Use `pnpm jest <path>` directly, not `pnpm test -- --testPathPattern`
9. **想定外の変更を安易に破棄しない**: ワーキングツリーに自分が行っていない変更（未知のファイル変更・新規ファイル）を発見した場合、**絶対に `git checkout --` や `git restore` で即座に元に戻さないこと**。バックグラウンドで動作中のワーカーサブエージェント（`/implement` 等）が並列に書き込んでいる可能性がある。まずユーザーに確認し、変更の出所を特定してから対処すること

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
- **Pipeline**: Prettier (priority 0) → markdownlint-cli2 --fix (priority 1) → nixfmt
- **Prettier**: JS/TS/JSX/TSX/JSON/MD/YAML
- **markdownlint-cli2**: `*.md` files — lint + auto-fix. Config: `.markdownlint.json`
- **nixfmt**: Nix files
- **ESLint**: NOT included in treefmt (linter, not formatter). Run separately with `pnpm eslint .`
- **VSCode**: treefmt-vscode extension auto-formats on save via direnv environment
- **CI check**: `nix flake check` validates all files are formatted and linted
- **`nix fmt`**: Also runs treefmt (works outside `nix develop`)

## Markdown Style Rules

Markdownファイルを生成・編集する際は、以下のルールに従うこと。treefmt が markdownlint-cli2 を実行し、違反があるとCIが失敗する。

- 見出しレベルは1つずつ増やす（h1→h2→h3、h1→h3は禁止）
- 見出しの前後に空行を入れる
- リストの前後に空行を入れる
- コードブロック（fenced）の前後に空行を入れる
- コードブロックには言語識別子を付ける（`bash,`ts, ```nix 等）
- 連続する空行は1行まで
- ファイル末尾は改行1つで終わる
- 強調記号の内側にスペースを入れない（`** text **` → `**text**`）
- リンクテキストの内側にスペースを入れない（`[ link ](url)` → `[link](url)`）
- ベアURLは使わずリンク記法を使う（`https://...` → `[text](https://...)`）
- 見出し末尾に句読点を付けない

## Nix Anti-Patterns to Avoid

- Avoid `rec { }` → use `let ... in` instead
- Avoid top-level `with` statements
- Avoid lookup paths `<...>` → use flake inputs
- Always quote URLs (RFC 45)

## Emulator操作

エミュレータの操作（スクリーンショット取得、UI要素のタップ、画面遷移の確認など）は**常にサブエージェント（`emulator-operator`）に委譲**すること。MCP toolの呼び出し（`mobile_take_screenshot`, `mobile_list_elements_on_screen` 等）は1回あたりのレスポンスが大きく、メインコンテキストを大量に消費するため、直接呼び出してはならない。

```text
Task tool → subagent_type: "emulator-operator"
```

## Official Plugins

公式マーケットプレイス（`claude-plugins-official`）が `.claude/settings.json` の `extraKnownMarketplaces` で有効化済み。`/plugin install <name>@claude-plugins-official` で各自インストール。

| プラグイン          | 用途                                                                 | 備考                                                 |
| ------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| `typescript-lsp`    | TS編集時の自動型診断・go-to-definition・find-references              | `typescript-language-server` は `nix develop` で提供 |
| `feature-dev`       | 探索・設計フェーズ（code-explorer / code-architect / code-reviewer） | `/implement` の Step 1 で活用                        |
| `pr-review-toolkit` | 包括的コードレビュー（6種の専門エージェント）                        | CI チェック後のオプション分析                        |
| `security-guidance` | Edit/Write 時のセキュリティパターン検出（eval, XSS 等9種）           | PreToolUse フック                                    |
| `commit-commands`   | `/commit`, `/commit-push-pr`, `/clean_gone`                          | Co-Authored-By 禁止ルールは CLAUDE.md で上書き       |

`/plugin` コマンドで利用可能なプラグインを確認・有効化できる。

## Worktree 規約

worktree は常に `.worktree/` ディレクトリに作成する。ビルトインの `EnterWorktree` は使わず、`git worktree add` で直接作成すること:

```bash
git worktree add ".worktree/<name>" -b "claude/<prefix>/<name>"
```

- **ディレクトリ**: `.worktree/<name>`（`.claude/worktrees/` は使わない）
- **ブランチ**: 必ず `claude/` プレフィックス + conventional prefix
- **例**: `claude/feat/calendar-sync`, `claude/fix/alarm-bug`, `claude/test/alarm-atoms`
- **作業完了後**: マージ確認後に worktree とブランチを削除する。rebase 後は `git branch -D`（強制削除）を使う

## 自動並列実装

`/implement` スキルで実装計画を並列ワーカーに自動ディスパッチできる。詳細は [Auto-Implement Guide](docs/llm/auto-implement.md) を参照。

- **スキル**: `.claude/skills/implement/SKILL.md` — オーケストレーター
- **エージェント**: `.claude/agents/worker.md` — 実装ワーカー（Opus, worktree分離）
- ワーカーはサブエージェントを呼べない（ネスト不可）ため、メインLLMがオーケストレーター役
- **feature-dev 連携**: テキスト記述の新規機能は `code-explorer` + `code-architect` で詳細な探索・設計が可能

## テスト自動追加

`/test` スキルでテストカバレッジのギャップを分析し、workerサブエージェントで並列にテストを作成する。

- **スキル**: `.claude/skills/test/SKILL.md` — テストオーケストレーター
- **フロー**: Explore分析 → タスク分解 → Worker並列作成 → マージ → 全テスト実行・修正
- **引数**: パス、ファイル、キーワード、または空（全体分析）
- `/implement` 完了後に自動提案される

## Parallel E2E Testing

`scripts/e2e-emulators.sh` でヘッドレスエミュレータプールを起動し、Detox で並列実行する。

- **ポート範囲**: 5580-5598（偶数、最大10台）。既存エミュレータ (5554等) には影響しない
- **Detox設定**: `android.e2e.debug` configuration (`e2e-pool` device, regex `emulator-558[0-9]`)
- **推奨台数**: 3台（RAM 6GB程度）。16GB以上のマシンなら4-5台も可
- **コマンド**: `pnpm e2e:pool:start` → `pnpm e2e:parallel` → `pnpm e2e:pool:stop`

詳細は [Parallel E2E Testing](docs/llm/parallel-e2e.md) を参照。

## Commit Messages

Conventional Commits 形式を使用する。

- **形式**: `type: 簡潔な説明` （英語、小文字始まり）
- **type**: `feat`, `fix`, `test`, `docs`, `chore`, `ci`, `refactor`, `move` など
- **Subject**: 1行で簡潔に。冗長な説明は避け、変更の要点だけを書く
- **Body**（任意）: 空行を挟んで補足。大きな変更のみ。箇条書きではなく平文で
- **Co-Authored-By 禁止**: Claude や他の AI を co-author として記載しない。`Co-Authored-By` 行を一切含めないこと

## Auto-Update Policy

When discovering new Nix information through web searches or problem-solving, automatically update relevant documentation files without being asked.

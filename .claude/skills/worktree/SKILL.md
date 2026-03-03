---
name: worktree
description: Create a git worktree in .worktree/ and work on a separate branch. Use when you need to work on an isolated branch without affecting the main working tree.
disable-model-invocation: true
---

# Git Worktree スキル

このスキルは `.worktree/` ディレクトリ以下に git worktree を作成し、独立したブランチで作業を行うためのものです。

## 重要: 並行作業の注意

**バックグラウンドで別の LLM エージェントが同時に作業している可能性があります。** 以下を厳守してください:

- **メインの作業ツリーのファイルを直接変更しない** — 必ず worktree 内で作業すること
- **`master` / `main` ブランチに直接コミットしない** — 必ず専用ブランチを使用すること
- **他の worktree のファイルに触れない** — `.worktree/` 内の他のディレクトリは別エージェントが使用中の可能性がある
- **共有リソース（ロックファイル等）に注意する** — 競合を避けること

## 手順

### 1. Worktree の作成

ユーザーから指示された内容に基づき、適切なブランチ名を決定してください。

```bash
# ブランチ名の例: claude/feat/calendar-sync, claude/fix/alarm-bug, claude/refactor/timer
BRANCH_NAME="claude/<conventional-prefix>/<feature-name>"
WORKTREE_DIR=".worktree/${BRANCH_NAME##*/}"

# worktree を作成（現在の HEAD から新しいブランチを切る）
git worktree add "$WORKTREE_DIR" -b "$BRANCH_NAME"
```

- `$ARGUMENTS` にブランチ名が指定されていればそれを使用する（`claude/` プレフィックスがなければ自動付与）
- 指定がなければタスク内容から適切なブランチ名を自動決定する
- ブランチ名は **必ず `claude/` プレフィックスを付け**、その後に `feat/`, `fix/`, `refactor/`, `chore/` などの conventional prefix を使用する

### 2. Worktree 内での作業

- **すべてのファイル操作は worktree ディレクトリ内で行うこと**
- パスは `.worktree/<name>/...` を使用する
- worktree 内でも `treefmt` によるフォーマットを実行する
- テストは worktree ディレクトリから実行する

### 3. コミットとクリーンアップ

作業完了後:

1. worktree 内で変更をコミットする
2. ユーザーに作業結果を報告する（ブランチ名、変更内容の要約）
3. **ユーザーの確認を得てから** worktree を削除し、マージ後にブランチも削除する:

```bash
# worktree の削除
git worktree remove "$WORKTREE_DIR"

# マージ後にブランチを削除（マージが完了してから実行）
git branch -d "$BRANCH_NAME"
```

1. 必要に応じてブランチのマージもユーザーに提案する
2. **マージ完了後は `claude/` ブランチを必ず削除する** — 作業完了済みのブランチを残さない
3. **rebase を使った場合**: コミットハッシュが変わるため `git branch -d` は「not fully merged」エラーになる。`git branch -D`（強制削除）を使うこと

### 3.5. マージ/リベース後の検証

作業をメインブランチに統合した後、`project-reviewer` サブエージェントを起動して品質を確認する:

```yaml
Task tool:
  subagent_type: "project-reviewer"
  description: "Post-merge validation"
  prompt: |
    マージ/リベース後の統合状態を検証してください。
    全チェック（tsc, eslint, treefmt, jest, nix flake check）を実行し、結果を報告してください。
```

問題があればオーケストレーターが修正し、再度 reviewer で通過を確認する。

### 4. エラー時の対応

- worktree 作成に失敗した場合、既存の worktree を `git worktree list` で確認する
- ブランチ名が既に存在する場合、サフィックスを追加するか別名を提案する
- クリーンアップに失敗した場合、`git worktree remove --force` の使用をユーザーに確認する

## 引数

- `$ARGUMENTS`: ブランチ名（省略可）。省略時はタスク内容から自動決定。

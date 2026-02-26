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
# ブランチ名の例: feat/calendar-sync, fix/alarm-bug, refactor/timer
BRANCH_NAME="<適切なブランチ名>"
WORKTREE_DIR=".worktree/${BRANCH_NAME##*/}"

# worktree を作成（現在の HEAD から新しいブランチを切る）
git worktree add "$WORKTREE_DIR" -b "$BRANCH_NAME"
```

- `$ARGUMENTS` にブランチ名が指定されていればそれを使用する
- 指定がなければタスク内容から適切なブランチ名を自動決定する
- ブランチ名は `feat/`, `fix/`, `refactor/`, `chore/` などの conventional prefix を使用する

### 2. Worktree 内での作業

- **すべてのファイル操作は worktree ディレクトリ内で行うこと**
- パスは `.worktree/<name>/...` を使用する
- worktree 内でも `treefmt` によるフォーマットを実行する
- テストは worktree ディレクトリから実行する

### 3. コミットとクリーンアップ

作業完了後:

1. worktree 内で変更をコミットする
2. ユーザーに作業結果を報告する（ブランチ名、変更内容の要約）
3. **ユーザーの確認を得てから** worktree を削除する:

```bash
git worktree remove "$WORKTREE_DIR"
```

4. 必要に応じてブランチのマージもユーザーに提案する

### 4. エラー時の対応

- worktree 作成に失敗した場合、既存の worktree を `git worktree list` で確認する
- ブランチ名が既に存在する場合、サフィックスを追加するか別名を提案する
- クリーンアップに失敗した場合、`git worktree remove --force` の使用をユーザーに確認する

## 引数

- `$ARGUMENTS`: ブランチ名（省略可）。省略時はタスク内容から自動決定。

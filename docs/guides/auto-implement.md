# 自動並列実装ガイド

Claude Code のスキルとサブエージェントを活用して、実装計画を複数のワーカーで並列に自動実装する仕組みです。

## 概要

```
ユーザー
  └─ /implement <フェーズ番号 or タスク> を実行
       └─ メインLLM（オーケストレーター）
            ├── 1. 実装計画を読み取り
            ├── 2. 独立タスクに分解
            ├── 3. ユーザー確認
            └── 4. worker サブエージェントを並列起動
                 ├── worker A (worktree A, Opus) ── タスク1
                 ├── worker B (worktree B, Opus) ── タスク2
                 └── worker C (worktree C, Opus) ── タスク3
```

各 worker は独立した git worktree で動作するため、互いに干渉しません。

## 構成ファイル

| ファイル | 役割 |
| --- | --- |
| `.claude/skills/implement/SKILL.md` | `/implement` スキル — オーケストレーション手順 |
| `.claude/agents/worker.md` | worker エージェント — 実装担当 |
| `docs/architecture.md` | 実装計画のソース（フェーズ定義） |

## 使い方

### 基本的な使い方

Claude Code のチャットで以下を入力:

```
/implement 11
```

これで Phase 11（Calendar integration）の実装計画が読み込まれ、タスク分解 → 確認 → 並列実装が開始されます。

### 引数のバリエーション

```bash
# フェーズ番号を指定
/implement 11

# 実装計画ファイルを直接指定
/implement docs/plans/calendar-sync.md

# タスクをテキストで直接記述
/implement CalendarScreenにイベント一覧表示を追加し、DaySelectorコンポーネントを実装する

# 引数なし — 対話的にタスクを決定
/implement
```

### 実行の流れ

1. **計画読み取り**: `docs/architecture.md` とメモリから該当フェーズの情報を収集
2. **タスク分解**: 並列実行可能な独立タスクに分解して一覧表示
3. **ユーザー確認**: タスク一覧を確認し、承認または修正を指示
4. **並列実装開始**: 承認後、各タスクに対して worker が worktree 内で自律的に実装
5. **結果報告**: 全 worker 完了後、成功/失敗・変更内容・テスト結果を報告

### 結果のマージ

worker は各 worktree 内でコミット済みの状態で終了します。マージは手動で行います:

```bash
# worktree のブランチ一覧を確認
git worktree list

# ブランチを確認
git log --oneline <branch-name>

# マージ
git merge <branch-name>

# マージ後に worktree を削除
git worktree remove <worktree-path>

# マージ済みブランチを削除（claude/ ブランチは作業完了後に必ず削除する）
git branch -d <branch-name>
```

複数ブランチを順番にマージする場合、コンフリクトが発生する可能性があります。その場合は通常の git merge conflict resolution で解決してください。

## worker エージェントの動作

各 worker は以下のフローで自律的に動作します:

1. タスク内容を理解し、関連する既存コードを読む
2. コードを実装（新規作成 or 既存ファイル編集）
3. テストを作成・実行
4. `treefmt` → `pnpm eslint .` → `pnpm jest` の品質チェック
5. 変更をコミット
6. 実装結果を報告

### worker の特徴

- **モデル**: Opus（最も高い推論能力）
- **分離**: git worktree（他の worker やメインツリーに影響しない）
- **ツール**: Read, Edit, Write, Bash, Glob, Grep（実装に必要な全ツール）
- **自律性**: 品質ゲートを通過するまで自分でデバッグ・修正を行う

## 設計上の制約

### サブエージェントのネスト不可

Claude Code ではサブエージェントがさらにサブエージェントを呼ぶことはできません。そのため、メインLLM自身がオーケストレーター役を担い、worker を直接起動する設計になっています。

### 並列数の目安

- **推奨**: 2〜4 タスクの並列実行
- **注意**: 5 タスク以上の場合は 2〜3 バッチに分割
- 各 worker は独立したコンテキストウィンドウを消費します

### タスク分解の原則

並列実行するタスクは以下を満たす必要があります:

- **ファイル非重複**: 同じファイルを複数の worker が編集しない
- **機能独立**: タスク A の出力がタスク B の入力にならない
- **テスト独立**: 各タスクのテストが他のタスクに依存しない

依存関係がある場合はバッチを分けて順次実行します:

```
バッチ1 (並列): [タスクA, タスクB]  ← 互いに独立
    ↓ マージ
バッチ2 (並列): [タスクC, タスクD]  ← A,Bの成果物に依存
```

## カスタマイズ

### worker のモデル変更

`.claude/agents/worker.md` の frontmatter で変更:

```yaml
model: sonnet  # opus → sonnet に変更（高速化、コスト削減）
```

### 実装計画の追加

`docs/architecture.md` に新しいフェーズを追加するか、独立した計画ファイルを作成して `/implement <ファイルパス>` で指定できます。

## トラブルシューティング

### worker が失敗した場合

失敗した worker の worktree はそのまま残ります:

```bash
# worktree の状態を確認
git worktree list

# 失敗した worktree に移動して手動確認
cd <worktree-path>
git log --oneline
git diff
```

手動修正後にコミットするか、worktree を削除してやり直せます。

### worktree の手動クリーンアップ

```bash
# すべての worktree を一覧
git worktree list

# 不要な worktree を削除
git worktree remove <path>

# 強制削除（未コミット変更を破棄）
git worktree remove --force <path>

# 無効な worktree 参照をクリーンアップ
git worktree prune
```

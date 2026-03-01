# 自動並列実装ガイド

Claude Code のスキルとサブエージェントで、実装計画を複数ワーカーで並列実装する仕組み。

## 概要

```text
ユーザー
  └─ /implement <フェーズ番号 or タスク>
       └─ メインLLM（オーケストレーター）
            ├── 実装計画を読み取り → 独立タスクに分解 → ユーザー確認
            └── worker サブエージェントを並列起動
                 ├── worker A (worktree A) ── タスク1
                 ├── worker B (worktree B) ── タスク2
                 └── worker C (worktree C) ── タスク3
```

各 worker は独立した git worktree で動作し、互いに干渉しない。

## 構成ファイル

| ファイル                            | 役割                           |
| ----------------------------------- | ------------------------------ |
| `.claude/skills/implement/SKILL.md` | `/implement` スキル定義        |
| `.claude/agents/worker.md`          | worker エージェント定義        |
| `docs/architecture.md`              | 実装計画のソース（フェーズ定義） |

## 使い方

```bash
/implement 11                    # フェーズ番号を指定
/implement docs/plans/sync.md    # 計画ファイルを直接指定
/implement CalendarScreenに...   # タスクをテキストで記述
/implement                       # 引数なし（対話的に決定）
```

### 実行フロー

1. `docs/architecture.md` とメモリから該当フェーズの情報を収集
2. 並列実行可能な独立タスクに分解して一覧表示
3. ユーザー確認（承認 or 修正指示）
4. 各タスクに対して worker が worktree 内で自律的に実装
5. 全 worker 完了後、結果を報告

### 結果のマージ

worker は各 worktree 内でコミット済みの状態で終了する。マージは手動:

```bash
git worktree list                      # ブランチ一覧を確認
git log --oneline <branch-name>        # 変更内容を確認
git merge <branch-name>                # マージ
git worktree remove <worktree-path>    # worktree を削除
git branch -d <branch-name>            # ブランチを削除
```

## 設計上の制約

### サブエージェントのネスト不可

Claude Code ではサブエージェントが更にサブエージェントを呼べない。メインLLMがオーケストレーター役を担い、worker を直接起動する。

### 並列数

- 推奨: 2-4 タスク並列
- 5 タスク以上は 2-3 バッチに分割

### タスク分解の原則

並列タスクは以下を満たすこと:

- **ファイル非重複**: 同じファイルを複数 worker が編集しない
- **機能独立**: タスク A の出力がタスク B の入力にならない
- **テスト独立**: 各タスクのテストが他タスクに依存しない

依存関係がある場合はバッチを分けて順次実行:

```text
バッチ1 (並列): [タスクA, タスクB]  <- 互いに独立
    | マージ
バッチ2 (並列): [タスクC, タスクD]  <- A,Bの成果物に依存
```

## カスタマイズ

`.claude/agents/worker.md` の frontmatter でモデルを変更可能:

```yaml
model: sonnet # opus -> sonnet（高速化、コスト削減）
```

## トラブルシューティング

失敗した worker の worktree はそのまま残る:

```bash
cd <worktree-path> && git log --oneline && git diff   # 状態確認
```

手動修正後にコミットするか、worktree を削除してやり直す:

```bash
git worktree remove <path>          # 削除
git worktree remove --force <path>  # 強制削除（未コミット変更を破棄）
git worktree prune                  # 無効な参照をクリーンアップ
```

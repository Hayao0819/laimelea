---
name: implement
description: Orchestrate parallel autonomous implementation using worker subagents in isolated worktrees. Reads the implementation plan from project docs/memory and dispatches workers.
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Task, Bash(git *), Bash(ls *)
---

# 自動並列実装オーケストレーター

このスキルはプロジェクトの実装計画を読み取り、複数のworkerサブエージェントをworktree分離で並列起動して自動実装を行います。

## 実行フロー

### Step 1: 実装計画の読み取り

以下のソースから実装計画を読み取ってください:

1. **アーキテクチャドキュメント**: `docs/architecture.md` — フェーズ定義と詳細設計
2. **メモリ**: `/home/hayao/.claude/projects/-home-hayao-Git-laimelea/memory/MEMORY.md` — 実装状況と残タスク
3. **引数で指定されたファイル**: `$ARGUMENTS` にファイルパスやフェーズ番号が含まれる場合、そのファイル/セクションを読む

`$ARGUMENTS` の解釈:

- 数字（例: `11`）→ Phase番号。architecture.mdから該当フェーズを読む
- ファイルパス → そのファイルを実装計画として読む
- テキスト → タスク説明としてそのまま使用
- 空 → ユーザーに何を実装するか質問する

### Step 2: タスク分解

読み取った実装計画を **独立して並列実行可能なタスク** に分解してください。

分解の原則:

- 各タスクは他のタスクに依存しない（ファイルが重複しない）こと
- 依存関係がある場合はフェーズを分けて順次実行する
- 1タスク = 1ワーカー = 1 worktree
- タスクが1つしかない場合でもworkerを使用する

各タスクに対して以下を明確に定義:

- **タスク名**: 短い説明（ブランチ名にも使用）
- **実装内容**: 何を実装するか、どのファイルを作成/変更するか
- **参照ファイル**: 既存コードで参考にすべきファイル
- **テスト要件**: テストが必要か、何をテストするか
- **受け入れ基準**: 完了条件

### Step 3: ユーザー確認

タスク分解結果をユーザーに提示し、承認を得てください。
以下を表示:

- タスク一覧（名前 + 概要）
- 並列実行グループ（依存関係に基づく）
- 使用モデル（opus）
- 推定worktree数

ユーザーが承認したら次のステップへ。修正要望があれば計画を調整。

### Step 4: ワーカー並列起動

**1つのメッセージ内で** 複数の Task tool 呼び出しを行い、ワーカーを並列起動してください。

各ワーカーの起動パラメータ:

```
Task tool:
  subagent_type: "worker"
  description: "<タスク名（3-5語）>"
  prompt: |
    ## タスク: <タスク名>

    ### 実装内容
    <具体的な実装指示>

    ### 対象ファイル
    - 作成: <新規ファイルパス>
    - 変更: <変更ファイルパス>

    ### 参照ファイル
    <既存の参考ファイルパス — パターンを踏襲すること>

    ### テスト要件
    <テストファイルパスと何をテストするか>

    ### 受け入れ基準
    - [ ] <条件1>
    - [ ] <条件2>
  model: "opus"
```

**重要**: `isolation: "worktree"` はworkerエージェント定義に含まれているため、Task tool呼び出し時に指定する必要はありません。

### Step 5: 結果収集と報告

全ワーカーの完了後:

1. 各ワーカーの結果を収集（成功/失敗、変更内容、テスト結果）
2. 失敗したタスクがあれば原因を分析し、リトライまたはユーザーに報告
3. 全worktreeのブランチ一覧を `git worktree list` で表示
4. マージ手順をユーザーに提示:

```bash
# 各worktreeのブランチをマージ
git merge <branch-name>
# worktreeを削除
git worktree remove <worktree-path>
```

## 注意事項

- workerサブエージェントはサブエージェントを呼べない（ネスト不可）
- 各workerは独立したworktreeで動作するため、ファイル競合は発生しない
- workerが失敗した場合、そのworktreeは残るので手動確認が可能
- 大量のタスク（5+）がある場合、2-3のバッチに分けて順次実行することを推奨

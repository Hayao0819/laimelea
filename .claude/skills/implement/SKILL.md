---
name: implement
description: Orchestrate parallel autonomous implementation using worker subagents in isolated worktrees. Reads the implementation plan from project docs/memory and dispatches workers.
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Task, Bash(git *), Bash(ls *), Bash(treefmt*), Bash(pnpm eslint*), Bash(pnpm tsc*), Bash(pnpm jest*)
---

# 自動並列実装オーケストレーター

このスキルはプロジェクトの実装計画を読み取り、複数のworkerサブエージェントをworktree分離で並列起動して自動実装を行います。

## 実行フロー

### Step 1: 実装計画の読み取り（サブエージェントに委譲）

**コンテキスト節約のため、architecture.md等の大きなドキュメントはオーケストレーターが直接Readしない。** サブエージェントに必要な情報だけを抽出させる。

`$ARGUMENTS` の解釈と使い分け:

- **Phase番号 / ファイルパス**（既知の計画あり）→ 従来の Explore サブエージェント（高速）
- **テキスト記述 / 新規機能**（探索・設計が必要）→ feature-dev プラグインの `code-explorer` + `code-architect` を並列起動（詳細な探索・設計）
- **空** → ユーザーに何を実装するか質問する

#### パターン A: Explore（Phase番号・ファイルパス指定時）

```yaml
Task tool:
  subagent_type: "Explore"
  description: "Extract implementation plan"
  prompt: |
    以下の情報を抽出し、簡潔にまとめて返してください。

    ## 対象
    <$ARGUMENTSに応じて: Phase番号、ファイルパス>

    ## 読むべきソース
    1. `docs/architecture.md` — 該当フェーズのセクションのみ抽出
    2. 関連する既存コードのパターン把握（対象ディレクトリの構造、型定義、隣接ファイル）

    ## 出力フォーマット（これ以外の情報は含めない）
    - 実装すべき機能の要約（5行以内）
    - 作成/変更が必要なファイル一覧（パスのみ）
    - 参照すべき既存ファイル一覧（パス + 参考にすべき点を1行で）
    - 主要な型定義・インターフェース（コードブロック）
    - テスト要件（箇条書き）
```

#### パターン B: feature-dev（テキスト記述・新規機能時）

`code-explorer` と `code-architect` を **並列起動** し、探索と設計を同時に行う:

```yaml
# 1つ目: コードベース探索
Task tool:
  subagent_type: "general-purpose"
  description: "Explore codebase for feature"
  prompt: |
    feature-dev プラグインの code-explorer として動作してください。
    タスク: <$ARGUMENTSのテキスト記述>
    - 関連する既存コード、型、パターンを網羅的に探索
    - 影響範囲の分析（依存関係、副作用）
    - 出力: ファイル一覧 + 参照すべきパターン + 型定義

# 2つ目（並列）: アーキテクチャ設計
Task tool:
  subagent_type: "Plan"
  description: "Design feature architecture"
  prompt: |
    feature-dev プラグインの code-architect として動作してください。
    タスク: <$ARGUMENTSのテキスト記述>
    - 既存アーキテクチャとの整合性を考慮した設計案
    - ファイル構成、データフロー、エッジケース
    - 出力: 設計概要 + タスク分解案
```

**MEMORY.md** はコンテキストに自動ロード済みなので直接参照する。

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

まず、各タスク用の worktree を `.worktree/` 以下に作成する:

```bash
# 各タスクに対して実行（ブランチ名には必ず claude/ プレフィックスを付ける）
git worktree add ".worktree/<task-name>" -b "claude/<conventional-prefix>/<task-name>"
# 例: git worktree add ".worktree/calendar-sync" -b "claude/feat/calendar-sync"
```

次に、**1つのメッセージ内で** 複数の Task tool 呼び出しを行い、ワーカーを並列起動してください。

各ワーカーの起動パラメータ:

```yaml
Task tool:
  subagent_type: "worker"
  description: "<タスク名（3-5語）>"
  max_turns: 100
  prompt: |
    ## 作業ディレクトリ
    `.worktree/<task-name>`（このディレクトリ内でのみ作業すること）

    ## タスク: <タスク名>

    ### 実装内容
    <具体的な実装指示 — 何を、なぜ、どのように実装するかを詳細に記述>

    ### 対象ファイル
    - 作成: <新規ファイルパス — ファイルの責務と主要なexportを明記>
    - 変更: <変更ファイルパス — 何を変更するかを明記>

    ### 参照ファイル（必ず事前に読んでパターンを踏襲すること）
    <既存ファイルパスのリスト — それぞれ何を参考にすべきかを注記>

    ### 型定義・インターフェース
    <主要な型、関数シグネチャ、データモデルを事前定義>

    ### エラーハンドリング・エッジケース
    <考慮すべきエラーケースとその処理方法>

    ### テスト要件
    <テストファイルパスと具体的なテストケース一覧>
    - 正常系: <シナリオ>
    - 異常系: <シナリオ>
    - エッジケース: <シナリオ>

    ### 受け入れ基準
    - [ ] <条件1>
    - [ ] <条件2>

    ### 最終報告（必ずこの形式で返すこと）
    以下のフォーマットのみ返す。コマンド出力やコード全文は含めない:
    - **結果**: 成功 / 失敗（失敗理由）
    - **作成ファイル**: パスの箇条書き
    - **変更ファイル**: パスの箇条書き
    - **テスト**: X passed, Y failed, Z skipped
    - **コミット**: ハッシュ（1行）
  model: "opus"
```

**重要**: オーケストレーターは各セクションを具体的に埋めること。プロンプトが詳細であるほどワーカーの出力品質が上がる。特に「参照ファイル」「型定義」「エラーハンドリング」を省略しないこと。

### Step 5: 結果収集

全ワーカーの完了後:

1. 各ワーカーの結果を収集（成功/失敗、変更ファイル、テスト結果）
2. 失敗したタスクがあれば原因を分析し、リトライまたはユーザーに報告
3. **成功したタスクのみ** Step 6 のマージ対象とする

### Step 6: 自動リベース（バッチ実行）

gitログをリニアに保つため、merge ではなく rebase を使用する。**コンテキスト節約のため、全ブランチのリベース・クリーンアップを1つの bash コマンドにまとめる。**

リベース順序を BRANCHES 配列で定義する。依存関係がある場合は基盤タスク（モデル、ユーティリティ等）を先に配置する。

```bash
# BRANCHES を実際のブランチ名・タスク名で埋める
BRANCHES=("claude/feat/task-a:task-a" "claude/feat/task-b:task-b")
for entry in "${BRANCHES[@]}"; do
  branch="${entry%%:*}"; task="${entry##*:}"
  echo "=== Rebasing $branch ==="
  if ! git rebase "$branch"; then
    echo "CONFLICT in $branch"; git rebase --abort; exit 1
  fi
  git worktree remove ".worktree/$task" 2>/dev/null
  # rebase後はハッシュが変わるため -D（強制削除）を使う
  git branch -D "$branch"
done && echo "ALL REBASES OK"
```

**コンフリクト発生時**: スクリプトが `CONFLICT in <branch>` で停止するので、どのブランチで発生したかをユーザーに報告し指示を待つ。**コンフリクトを自動解決しないこと。**

### Step 7: リベース後検証（project-reviewer）

全ブランチのリベースが完了したら:

#### 7a. 自動修正可能な問題を先に解消

reviewerを起動する前に、フォーマット・リントの自動修正をまとめて実行する。コンテキスト節約のため1コマンドにチェーンする:

```bash
treefmt && pnpm eslint . --fix && pnpm eslint . && pnpm tsc --noEmit
```

エラーがあればこの時点で手動修正する。自動修正で変更があれば `chore: fix lint and formatting` でコミットする。

#### 7b. project-reviewer で最終検証

```yaml
Task tool:
  subagent_type: "project-reviewer"
  description: "Post-rebase validation"
  prompt: |
    リベース後の統合状態を検証してください。
    全チェック（tsc, eslint, treefmt, jest, nix flake check）を実行し、結果を報告してください。
```

- **ALL CHECKS PASSED** → Step 8 へ進む
- **FAIL あり** → オーケストレーターが問題を修正し、再度 reviewer で確認

**重要**: `project-reviewer` はファイルを一切変更しない読み取り専用エージェント。

#### 7c. オプション: 深いコード品質分析

project-reviewer 通過後、大規模な変更や新規機能の場合は `code-reviewer`（feature-dev プラグイン）による深いコード品質分析をユーザーに提案する。パターン準拠、セキュリティ、パフォーマンス等のヒューリスティック分析が可能。

全ゲート通過後、最終結果をユーザーに報告:

- マージされたブランチ一覧
- 変更ファイル数・追加行数の概要
- テスト結果（pass/fail/skip）
- 残存する問題（あれば）

### Step 8: テスト拡充（/test スキル連携）

マージ後検証が完了したら、ユーザーに `/test` スキルの実行を提案する:

> 実装が完了しました。`/test` スキルを実行して、新規実装のテストカバレッジを拡充しますか？

ユーザーが承認した場合、`/test` スキルを呼び出す（Skill tool で `skill: "test"` を実行）。引数には今回の実装で変更されたディレクトリパスを渡す。

これにより、実装→テスト作成→全テスト通過の一連のフローが完結する。

## 注意事項

- workerサブエージェントはサブエージェントを呼べない（ネスト不可）
- 各workerは独立したworktreeで動作するため、ファイル競合は発生しない
- workerが失敗した場合、そのworktreeは残るので手動確認が可能
- 大量のタスク（5+）がある場合、2-3のバッチに分けて順次実行することを推奨

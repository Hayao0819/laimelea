---
name: test
description: Analyze test coverage gaps, create missing tests using worker subagents, then run and fix all tests. Uses Explore subagent for analysis and Worker subagents for parallel test creation.
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Task, Bash(git *), Bash(ls *), Bash(treefmt*), Bash(pnpm eslint*), Bash(pnpm jest*)
---

# テスト追加・実行・修正オーケストレーター

このスキルはコードベースのテストカバレッジを分析し、不足しているテストをworkerサブエージェントで並列作成し、全テストが通ることを確認します。

## 実行フロー

### Step 1: スコープの決定

`$ARGUMENTS` の解釈:

- **パス**（例: `src/features/alarm`）→ そのディレクトリに限定してカバレッジ分析
- **ファイルパス**（例: `src/core/time/conversions.ts`）→ そのファイルのテストを作成/改善
- **キーワード**（例: `atoms`, `hooks`, `models`）→ 該当カテゴリのテストに限定
- **空** → コードベース全体を分析し、最も優先度の高い未テスト領域を特定

### Step 2: カバレッジ分析（Exploreサブエージェント）

Explore サブエージェントを起動して、テストカバレッジのギャップを分析する。

```
Task tool:
  subagent_type: "Explore"
  description: "Analyze test coverage gaps"
  prompt: |
    プロジェクトのテストカバレッジを分析してください。

    ## 分析対象
    <Step 1で決定したスコープ>

    ## 分析内容
    1. `src/` 以下のソースファイルを列挙
    2. `__tests__/` 以下の対応するテストファイルの有無を確認
    3. テストがあるファイルについて、テスト内容を読み、カバレッジの十分さを評価
    4. テストがないファイルを優先度付きでリストアップ

    ## 優先度の判断基準（高→低）
    1. ビジネスロジック（core/, models/, atoms/）— バグの影響が大きい
    2. カスタムフック（hooks/）— 複数画面で共有される
    3. サービス・ユーティリティ（services/, strategies/）— 単体テストしやすい
    4. 画面コンポーネント（screens/）— 統合テストとして価値がある
    5. UIコンポーネント（components/）— スナップショット or インタラクションテスト

    ## 出力フォーマット
    各ファイルについて以下を報告:
    - ファイルパス
    - テストの有無（有の場合はカバレッジ評価）
    - 推奨するテスト内容（何をテストすべきか）
    - 優先度（高/中/低）
    - テスト作成の難易度（簡単/普通/複雑）
    - 必要なモック（AsyncStorage, Notifee, Navigation等）
```

### Step 3: テストタスク分解

Explore の分析結果を元に、テスト作成タスクを分解する。

分解の原則:

- **1タスク = 関連する1-3ファイルのテスト** — 同一モジュール内のファイルはまとめてよい
- 各タスクは他のタスクに依存しない（テストファイルが重複しない）こと
- 既存テストの改善と新規テスト作成を区別する
- モックパターンが共通のファイルはまとめると効率的

各タスクに対して以下を定義:

- **タスク名**: 短い説明（例: `test-alarm-atoms`）
- **対象ファイル**: テスト対象のソースファイルパス
- **テストファイル**: 作成するテストファイルパス（`__tests__/` 配下、src構造をミラー）
- **テスト内容**: 何をテストするか（関数名、シナリオ、エッジケース）
- **参照テスト**: パターンを踏襲すべき既存テストファイル
- **必要なモック**: モックすべきモジュール
- **受け入れ基準**: テストが通ること + カバレッジ要件

### Step 4: ユーザー確認

タスク分解結果をユーザーに提示し、承認を得る。以下を表示:

- テスト作成タスク一覧（対象ファイル + テスト概要）
- 新規テストファイル数
- 並列実行グループ
- 推定worker数

ユーザーが承認したら次のステップへ。修正要望があれば計画を調整。

### Step 5: ワーカー並列起動

まず、各タスク用の worktree を `.worktree/` 以下に作成する:

```bash
# 各タスクに対して実行（ブランチ名には必ず claude/ プレフィックスを付ける）
git worktree add ".worktree/<task-name>" -b "claude/<conventional-prefix>/<task-name>"
# 例: git worktree add ".worktree/test-alarm-atoms" -b "claude/test/alarm-atoms"
```

次に、**1つのメッセージ内で** 複数の Task tool 呼び出しを行い、ワーカーを並列起動する。

各ワーカーの起動パラメータ:

```
Task tool:
  subagent_type: "worker"
  description: "<タスク名（3-5語）>"
  max_turns: 100
  prompt: |
    ## 作業ディレクトリ
    `.worktree/<task-name>`（このディレクトリ内でのみ作業すること）

    ## タスク: <テスト対象>のテスト作成

    ### テスト対象ファイル
    <ソースファイルパスのリスト>

    ### 作成するテストファイル
    <テストファイルパスのリスト（__tests__/ 配下）>

    ### テスト内容
    <具体的なテストケースの説明>
    - describe/itの構造
    - テストすべきシナリオ（正常系、異常系、エッジケース）
    - 期待される振る舞い

    ### 参照テスト（必ず事前に読んでパターンを踏襲すること）
    <既存テストファイルパス — モック方法やテストスタイルの参考。それぞれ何を参考にすべきかを注記>

    ### モック設定
    <必要なモック一覧と設定方法を具体的に記述>

    ### 受け入れ基準
    - [ ] テストが全てパスすること (`pnpm jest <テストファイルパス>`)
    - [ ] テスト対象の主要なロジック/分岐がカバーされていること
    - [ ] 既存テストのパターンに準拠していること
    - [ ] treefmt + eslint がパスすること
  model: "opus"
```

**重要**: オーケストレーターは各セクションを具体的に埋めること。特に「参照テスト」にはモックパターンの参考元を、「テスト内容」には具体的なテストケース名を列挙すること。

### Step 6: 結果収集とリベース

全ワーカーの完了後:

1. 各ワーカーの結果を収集（成功/失敗、作成テスト数、テスト結果）
2. 失敗したタスクがあれば原因を分析し、リトライまたはユーザーに報告
3. **成功したタスクのみ** リベース対象とする

```bash
# 1. 成功した各ブランチを順次リベース
git rebase <branch-name>

# 2. リベース成功後、worktreeを削除
git worktree remove .worktree/<task-name>

# 3. マージ済みブランチを削除（claude/ ブランチは作業完了後に必ず削除する）
git branch -d <branch-name>
```

**コンフリクト発生時**:

1. `git rebase --abort` でリベースを取り消す
2. コンフリクトの内容をユーザーに報告する
3. ユーザーの指示を待つ
4. **コンフリクトを自動解決しようとしないこと**

### Step 7: 統合テスト実行と修正

全ブランチのリベース完了後、統合状態で全テストを実行:

```bash
# 1. フォーマット
treefmt

# 2. リント
pnpm eslint . --fix
pnpm eslint .

# 3. 全テスト実行
pnpm jest
```

**テスト失敗時の修正フロー**:

1. 失敗したテストのエラーメッセージを分析
2. 原因を特定（テストコードの問題 or プロダクションコードの問題）
3. **テストコードの問題**: テストを修正（モック不足、非同期処理の漏れ、期待値の誤り等）
4. **プロダクションコードの問題**: ユーザーに報告し、修正方針を確認（テストがバグを発見した可能性）
5. 修正後、再度全テストを実行
6. 全テスト通過まで繰り返す

### Step 8: 最終報告

全ゲート通過後、ユーザーに最終結果を報告:

- 作成したテストファイル一覧
- テスト数（pass/fail/skip）の変化（Before → After）
- 発見されたバグや問題点（あれば）
- カバレッジの改善状況
- 残存する未テスト領域（あれば）

## テスト作成ガイドライン

workerに渡すプロンプトには、以下のガイドラインを含めること:

### 一般原則

- `@testing-library/react-native` v13 を使用 — **全APIがasync**（`await render()`, `await fireEvent.press()` 等）
- テストファイルは `__tests__/` 以下に `src/` のディレクトリ構造をミラーして配置
- ファイル名は `<対象ファイル名>.test.ts` or `.test.tsx`
- `describe` でモジュール/関数名をグルーピング、`it` で具体的な振る舞いを記述

### モックパターン（既存テストから踏襲）

```typescript
// AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// i18n
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: jest.fn() },
  }),
}));

// Notifee
jest.mock("@notifee/react-native", () => ({
  createChannel: jest.fn(),
  displayNotification: jest.fn(),
  cancelNotification: jest.fn(),
  // ... 必要に応じて追加
}));

// react-native-paper
jest.mock("react-native-paper", () => {
  const actual = jest.requireActual("react-native-paper");
  return { ...actual };
});
```

### コンポーネントテストのProvider設定

```typescript
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";

const renderWithProviders = (ui: React.ReactElement) => {
  const store = createStore();
  return render(
    <JotaiProvider store={store}>
      <PaperProvider>{ui}</PaperProvider>
    </JotaiProvider>,
  );
};
```

## 注意事項

- workerサブエージェントはサブエージェントを呼べない（ネスト不可）
- 各workerは独立したworktreeで動作するため、テストファイルの競合は発生しない
- テスト対象のプロダクションコードは変更しない（テストコードのみ作成）
- 既存テストを破壊しないこと — マージ後に既存テストも含めて全件通過を確認する
- 大量のタスク（5+）がある場合、2-3のバッチに分けて順次実行することを推奨

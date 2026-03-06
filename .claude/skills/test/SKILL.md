---
name: test
description: Analyze test coverage gaps (unit + E2E), create missing tests using worker subagents, then run and fix all tests. Uses Explore subagent for analysis and Worker subagents for parallel test creation.
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Task, Bash(git *), Bash(ls *), Bash(treefmt*), Bash(pnpm eslint*), Bash(pnpm tsc*), Bash(pnpm jest*), Bash(pnpm e2e:test*)
---

# テスト追加・実行・修正オーケストレーター

このスキルはコードベースのテストカバレッジを分析し、不足しているテスト（Jest単体テスト + Detox E2Eテスト）をworkerサブエージェントで並列作成し、全テストが通ることを確認します。

## 実行フロー

### Step 1: スコープの決定

`$ARGUMENTS` の解釈:

- **パス**（例: `src/features/alarm`）→ そのディレクトリに限定してカバレッジ分析
- **ファイルパス**（例: `src/core/time/conversions.ts`）→ そのファイルのテストを作成/改善
- **キーワード**（例: `atoms`, `hooks`, `models`）→ 該当カテゴリのテストに限定
- **空** → コードベース全体を分析し、最も優先度の高い未テスト領域を特定

### Step 2: カバレッジ分析（サブエージェント）

サブエージェントを起動して、**単体テスト + E2Eテスト** のカバレッジギャップを分析する。

**エージェント選択**: 通常は Explore サブエージェントで十分。既存コードのテストパターンを深く分析する必要がある場合（複雑なモック構成、統合テスト設計等）は feature-dev の `code-explorer` も有効。

```yaml
Task tool:
  subagent_type: "Explore"
  description: "Analyze test coverage gaps"
  prompt: |
    プロジェクトのテストカバレッジを分析してください。

    ## 分析対象
    <Step 1で決定したスコープ>

    ## Part A: 単体テスト分析
    1. `src/` 以下のソースファイルを列挙
    2. `__tests__/` 以下の対応するテストファイルの有無を確認
    3. テストがあるファイルについて、テスト内容を読み、カバレッジの十分さを評価
    4. テストがないファイルを優先度付きでリストアップ

    ### 単体テスト優先度の判断基準（高→低）
    1. ビジネスロジック（core/, models/, atoms/）— バグの影響が大きい
    2. カスタムフック（hooks/）— 複数画面で共有される
    3. サービス・ユーティリティ（services/, strategies/）— 単体テストしやすい
    4. 画面コンポーネント（screens/）— 統合テストとして価値がある
    5. UIコンポーネント（components/）— スナップショット or インタラクションテスト

    ## Part B: E2Eテスト分析
    1. `__tests__/e2e/` 以下の既存E2Eテストファイルを列挙し、カバーしているフローを把握
    2. `src/screens/` の各画面と機能を列挙し、E2Eテストの有無を確認
    3. 以下の観点で未カバーのユーザーフローを特定:
       - 新規追加された画面・機能にE2Eテストがないか
       - 既存E2Eテストでカバーされていない重要なユーザー操作があるか
       - エッジケース（空状態、エラー表示、スクロール、ダイアログ等）のテスト不足
    4. 各画面のtestIDの有無を確認（E2Eテストに必要）

    ### E2Eテスト優先度の判断基準（高→低）
    1. ユーザーのコアフロー（setup, alarm CRUD, timer操作）— 回帰リスクが高い
    2. 画面遷移・ナビゲーション — ルーティングのバグを防ぐ
    3. 設定変更と永続化 — 設定が正しく保存・反映されるか
    4. エラーハンドリング・境界値 — ダイアログ、空状態、入力バリデーション

    ## 出力フォーマット

    ### 単体テストギャップ
    各ファイルについて:
    - ファイルパス
    - テストの有無（有の場合はカバレッジ評価）
    - 推奨するテスト内容（何をテストすべきか）
    - 優先度（高/中/低）
    - テスト作成の難易度（簡単/普通/複雑）
    - 必要なモック（AsyncStorage, Notifee, Navigation等）

    ### E2Eテストギャップ
    各ユーザーフローについて:
    - フロー名（例: "Desk Clock toggle"）
    - 対応画面/機能
    - 既存E2Eテストの有無（有の場合は不足シナリオ）
    - 推奨するテストシナリオ
    - 優先度（高/中/低）
    - testID追加が必要なコンポーネント（あれば）
```

### Step 3: テストタスク分解

Explore の分析結果を元に、**単体テストタスク** と **E2Eテストタスク** を分解する。

#### 3a: 単体テストタスク

分解の原則:

- **1タスク = 関連する1-3ファイルのテスト** — 同一モジュール内のファイルはまとめてよい
- 各タスクは他のタスクに依存しない（テストファイルが重複しない）こと
- 既存テストの改善と新規テスト作成を区別する
- モックパターンが共通のファイルはまとめると効率的

各タスクに対して以下を定義:

- **タスク名**: 短い説明（例: `test-alarm-atoms`）
- **種別**: `unit`
- **対象ファイル**: テスト対象のソースファイルパス
- **テストファイル**: 作成するテストファイルパス（`__tests__/` 配下、src構造をミラー）
- **テスト内容**: 何をテストするか（関数名、シナリオ、エッジケース）
- **参照テスト**: パターンを踏襲すべき既存テストファイル
- **必要なモック**: モックすべきモジュール
- **受け入れ基準**: テストが通ること + カバレッジ要件

#### 3b: E2Eテストタスク

分解の原則:

- **1タスク = 1つの画面 or 1つのユーザーフロー** — E2Eテストは機能フロー単位で分割
- 新規E2Eテストファイルの場合は `__tests__/e2e/<feature>.e2e.ts` に配置
- 既存E2Eテストファイルへのシナリオ追加も1タスクとして扱う
- testID追加が必要な場合、ソースコードの変更もタスクに含める

各タスクに対して以下を定義:

- **タスク名**: 短い説明（例: `e2e-deskclock-toggle`）
- **種別**: `e2e`
- **対象画面/機能**: テスト対象の画面・フロー
- **テストファイル**: 作成/編集するE2Eテストファイルパス（`__tests__/e2e/` 配下）
- **テストシナリオ**: テストするユーザー操作フロー（ステップバイステップ）
- **参照テスト**: パターンを踏襲すべき既存E2Eテストファイル
- **testID追加**: ソースコードに追加が必要なtestIDの一覧（ファイルパス + コンポーネント + testID名）
- **前提条件**: テスト実行前に必要な状態（setup完了、特定の画面遷移等）
- **受け入れ基準**: `pnpm e2e:test` で通ること（エミュレータ起動が必要）

### Step 4: ユーザー確認

タスク分解結果をユーザーに提示し、承認を得る。以下を表示:

- **単体テスト** タスク一覧（対象ファイル + テスト概要）
- **E2Eテスト** タスク一覧（対象フロー + テストシナリオ概要）
- 新規テストファイル数（単体 + E2E）
- 並列実行グループ
- 推定worker数
- E2Eテスト実行にはエミュレータが必要な旨

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

```yaml
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
    - [ ] treefmt + eslint + tsc がパスすること

    ### 最終報告（必ずこの形式で返すこと）
    以下のフォーマットのみ返す。コマンド出力やコード全文は含めない:
    - **結果**: 成功 / 失敗（失敗理由）
    - **作成ファイル**: パスの箇条書き
    - **テスト数**: X passed, Y failed, Z skipped
    - **コミット**: ハッシュ（1行）
  model: "opus"
```

#### E2Eテストワーカーのプロンプトテンプレート

```yaml
Task tool:
  subagent_type: "worker"
  description: "<タスク名（3-5語）>"
  max_turns: 100
  prompt: |
    ## 作業ディレクトリ
    `.worktree/<task-name>`（このディレクトリ内でのみ作業すること）

    ## タスク: <対象画面/機能>のE2Eテスト作成

    ### テスト対象
    <画面名・機能名とユーザーフローの概要>

    ### 作成/編集するテストファイル
    `__tests__/e2e/<feature>.e2e.ts`

    ### テストシナリオ
    <ステップバイステップのユーザー操作フロー>
    - describe/itの構造
    - 各itで検証するユーザー操作と期待結果
    - 前提条件（setup完了、画面遷移等）

    ### testID追加が必要なソースファイル（あれば）
    <ファイルパス + コンポーネント + 追加するtestID名>
    ※ E2Eテストでは `by.id()` でtestIDを参照するため、
      ソースコンポーネントに `testID` propが設定されている必要がある

    ### 参照テスト（必ず事前に読んでパターンを踏襲すること）
    - `__tests__/e2e/utils/helpers.ts` — ヘルパー関数（launchAppFresh, completeSetup, navigateToTab, waitVisible）
    - <既存E2Eテストファイルパス — 類似フローのテストパターン参考>

    ### E2Eテスト作成ルール
    - Detox v20 API を使用: `import { device, element, by, expect, waitFor } from "detox"`
    - ヘルパー関数を活用: `import { launchAppFresh, completeSetup, navigateToTab, waitVisible } from "./utils/helpers"`
    - 要素選択: `by.id(testID)` を優先、テキストは `by.text()`, アクセシビリティは `by.label()`
    - MD3 BottomNavigation のラベル重複: `element(by.text("Label")).atIndex(0).tap()`
    - Switch コンポーネント: `by.type("com.facebook.react.views.switchview.ReactSwitch")`
    - 待機: `waitFor(element(...)).toBeVisible().withTimeout(5000)`
    - キーボード dismissal: 入力後に `await device.pressBack()`
    - スクロール: `element(by.id("scroll-container")).scrollTo("bottom")`
    - 全操作は `async/await` 必須
    - テストファイル名: `<feature>.e2e.ts`（.test.ts ではない）

    ### 受け入れ基準
    - [ ] テストファイルが正しい場所に配置されていること
    - [ ] 既存E2Eテストのパターンに準拠していること
    - [ ] testID追加が必要な場合、ソースコードも修正していること
    - [ ] treefmt + eslint + tsc がパスすること
    - [ ] `pnpm jest __tests__/e2e/<feature>.e2e.ts` で構文エラーがないこと（Detox実行は不要）

    ### 最終報告（必ずこの形式で返すこと）
    以下のフォーマットのみ返す。コマンド出力やコード全文は含めない:
    - **結果**: 成功 / 失敗（失敗理由）
    - **作成/変更ファイル**: パスの箇条書き
    - **テスト数**: X passed, Y failed, Z skipped
    - **コミット**: ハッシュ（1行）
  model: "opus"
```

**重要**: オーケストレーターは各セクションを具体的に埋めること。特に「参照テスト」にはモックパターンの参考元を、「テスト内容」/「テストシナリオ」には具体的なテストケース名を列挙すること。

### Step 6: 結果収集とリベース（バッチ実行）

全ワーカーの完了後:

1. 各ワーカーの結果を収集（成功/失敗、作成テスト数、テスト結果）
2. 失敗したタスクがあれば原因を分析し、リトライまたはユーザーに報告
3. **成功したタスクのみ** リベース対象とする

**コンテキスト節約のため、全ブランチのリベース・クリーンアップを1つの bash にまとめる:**

```bash
BRANCHES=("claude/test/task-a:task-a" "claude/test/task-b:task-b")
for entry in "${BRANCHES[@]}"; do
  branch="${entry%%:*}"; task="${entry##*:}"
  echo "=== Rebasing $branch ==="
  if ! git rebase "$branch"; then
    echo "CONFLICT in $branch"; git rebase --abort; exit 1
  fi
  git worktree remove ".worktree/$task" 2>/dev/null
  git branch -D "$branch"  # rebase後はハッシュが変わるため -D を使う
done && echo "ALL REBASES OK"
```

**コンフリクト発生時**: スクリプトが停止するのでユーザーに報告し指示を待つ。**自動解決しないこと。**

### Step 7: 統合検証（project-reviewer）

#### 7a. 自動修正可能な問題を先に解消

```bash
treefmt && pnpm eslint . --fix && pnpm eslint . && pnpm tsc --noEmit
```

エラーがあれば手動修正し、自動修正で変更があればコミットする。

#### 7b. project-reviewer で最終検証

```yaml
Task tool:
  subagent_type: "project-reviewer"
  description: "Post-merge test validation"
  prompt: |
    テストブランチのリベース後の統合状態を検証してください。
    全チェック（tsc, eslint, treefmt, jest, nix flake check）を実行し、結果を報告してください。
```

- **ALL CHECKS PASSED** → Step 8 へ進む
- **FAIL あり** → オーケストレーターが問題を修正し、再度 reviewer で確認

**単体テスト失敗時**: エラーメッセージを分析し、テストコードの問題は修正、プロダクションコードの問題はユーザーに報告。修正後 reviewer で再確認。

**E2Eテスト**: エミュレータ未起動時は型チェックのみ、手動実行を依頼する。

### Step 8: 最終報告

全ゲート通過後、ユーザーに最終結果を報告:

- 作成したテストファイル一覧（単体テスト + E2Eテスト）
- 単体テスト数（pass/fail/skip）の変化（Before → After）
- E2Eテスト数の変化（Before → After）
- ソースコードへのtestID追加一覧（E2Eテスト用に追加した場合）
- 発見されたバグや問題点（あれば）
- カバレッジの改善状況
- 残存する未テスト領域（あれば）
- E2Eテスト未実行の場合はその旨と手動実行コマンド（`pnpm e2e:test`）

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

## E2Eテスト作成ガイドライン

workerに渡すプロンプトには、以下のE2Eガイドラインを含めること:

### フレームワーク

- **Detox v20** を使用 — React Native向けグレーボックスE2Eテストフレームワーク
- テストファイルは `__tests__/e2e/` 配下に `<feature>.e2e.ts` として配置
- 設定: `.detoxrc.js` + `__tests__/e2e/jest.config.js`

### インポートパターン

```typescript
import { device, element, by, expect, waitFor } from "detox";
import {
  launchAppFresh,
  launchApp,
  completeSetup,
  navigateToTab,
  waitVisible,
} from "./utils/helpers";
```

### ヘルパー関数

| 関数                            | 用途                                       |
| ------------------------------- | ------------------------------------------ |
| `launchAppFresh()`              | AsyncStorage クリア + 新規起動             |
| `launchApp()`                   | 既存状態を保持して起動                     |
| `completeSetup(hours, minutes)` | セットアップ画面を完了                     |
| `navigateToTab(label)`          | BottomTab に遷移（`.atIndex(0)` 対応済み） |
| `waitVisible(testID, timeout)`  | 要素の表示を待機                           |

### 要素選択の優先順位

1. `by.id(testID)` — 最も安定。コンポーネントに `testID` prop を設定
2. `by.text("表示テキスト")` — 動的でないテキストに使用
3. `by.label("Accessibility Label")` — アクセシビリティラベル
4. `by.type("NativeClassName")` — ネイティブコンポーネント（最終手段）

### よく使うパターン

```typescript
// MD3 BottomNavigation のラベル重複対策
await element(by.text("Alarm")).atIndex(0).tap();

// Switch（react-native-paper の Switch は ReactSwitch としてレンダリング）
const toggle = element(
  by.type("com.facebook.react.views.switchview.ReactSwitch"),
).atIndex(0);
await toggle.tap();

// 要素の待機
await waitFor(element(by.id("dialog")))
  .toBeVisible()
  .withTimeout(5000);

// 要素の非表示待機
await waitFor(element(by.id("dialog")))
  .not.toBeVisible()
  .withTimeout(5000);

// スクロール
await element(by.id("scroll-view")).scrollTo("bottom");

// キーボード dismiss
await device.pressBack();

// テキスト入力
await element(by.id("input")).clearText();
await element(by.id("input")).typeText("value");
```

### テスト構造のベストプラクティス

- `beforeAll` でアプリ起動 + セットアップ完了 + 対象画面への遷移
- `describe` で機能グループ、`it` で個別の操作・検証
- テストは順序依存（前のテストの状態を引き継ぐ）が許容される（E2Eテストの特性上）
- タイムアウトは `waitFor(...).withTimeout(ms)` で明示的に設定

### testID 追加のルール

E2Eテストで `by.id()` を使うために、ソースコンポーネントに `testID` を追加する場合:

- 命名規則: `kebab-case`（例: `alarm-edit-screen`, `save-button`, `cycle-hours-input`）
- 画面のルートコンポーネントには `<feature>-screen`（例: `clock-screen`, `settings-screen`）
- ボタンには `<action>-button`（例: `save-button`, `delete-button`）
- 入力フィールドには `<field>-input`（例: `label-input`, `hours-input`）
- 既存の `testID` と重複しないこと

## 注意事項

- workerサブエージェントはサブエージェントを呼べない（ネスト不可）
- 各workerは独立したworktreeで動作するため、テストファイルの競合は発生しない
- 単体テストworkerはテスト対象のプロダクションコードを変更しない（テストコードのみ作成）
- **E2Eテストworkerはtestid追加のためにソースコードを変更してよい**（ただしtestID prop追加のみ、ロジック変更は不可）
- 既存テストを破壊しないこと — マージ後に既存テストも含めて全件通過を確認する
- 大量のタスク（5+）がある場合、2-3のバッチに分けて順次実行することを推奨
- E2Eテストの実行（`pnpm e2e:test`）にはエミュレータ + ビルド済みAPKが必要。エミュレータが起動していない場合は型チェックのみで検証し、手動実行を依頼する
- E2Eテストファイルの競合に注意: 同一の `.e2e.ts` ファイルを複数workerが編集しないようにタスクを分解すること

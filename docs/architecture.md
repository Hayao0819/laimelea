# Laimelea - カスタム時計アプリ設計計画

## Context

ユーザーは約26時間周期の生活リズムを持ち、毎日就寝時間が約2時間ずつズレていく。標準の24時間時計では生活管理が困難なため、任意の時間周期（26h, 28hなど）に対応したAndroid時計アプリ「Laimelea」を開発する。

Googleカレンダー連携、カスタム時間でのアラーム、カレンダー予定連動アラーム等の機能により、非24時間生活を総合的にサポートする。

---

## 技術スタック

| 技術                                                  | 選定理由                                                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| React Native 0.84 CLI + TypeScript                    | ネイティブAndroid機能（AlarmManager等）へのフルアクセス。New Architecture                                                    |
| react-native-paper v5 (5.15.x)                        | Material 3準拠、40+コンポーネント、デザインコード最小化。New Arch対応はInterop Layer経由                                     |
| Jotai v2                                              | 軽量アトミック状態管理、`atomWithStorage` + `createJSONStorage` + `getOnInit: true`                                          |
| @react-navigation/bottom-tabs v7                      | Bottom Tab Navigator。`BottomNavigation.Bar`(Paper)をtabBarに指定してMD3スタイル適用                                         |
| @react-navigation/native-stack v7                     | Stack Navigator                                                                                                              |
| @notifee/react-native v9                              | AlarmManager連携（**GMS不要、AOSP API**）、フルスクリーン通知                                                                |
| react-native-app-auth v8                              | OAuth2 PKCE認証（**GMS不要**、Chrome Custom Tabs使用）                                                                       |
| @react-native-google-signin/google-signin v16         | GMS環境でのGoogle認証（RN 0.84対応。v13は非互換）                                                                            |
| @react-native-async-storage/async-storage v3          | Jotaiの永続化バックエンド。v3でscoped storage導入、default exportは互換維持                                                  |
| カスタムTurbo Module (CalendarContract)               | Android CalendarContract経由のローカルカレンダー読取（**GMS不要**）。react-native-calendar-eventsは5年間未更新のため自前実装 |
| react-native-svg v15                                  | アナログ時計描画                                                                                                             |
| react-native-shake v6                                 | アラーム解除用シェイク検出                                                                                                   |
| react-native-reanimated v4 + react-native-worklets    | 時計アニメーション。v4はNew Arch専用。Babel plugin = `react-native-worklets/plugin`                                          |
| date-fns v4                                           | 実時間の日付操作（カスタム時間計算は独自実装）                                                                               |
| @date-fns/tz v1                                       | タイムゾーン対応表示（date-fns v4公式。旧date-fns-tzは非推奨）                                                               |
| i18next + react-i18next v16                           | 多言語対応（v16でReact 19対応。翻訳ファイル追加のみで新言語対応可能）                                                        |
| react-native-localize                                 | デバイスの言語・タイムゾーン検出（IANA形式）                                                                                 |
| Jest + @testing-library/react-native v13              | ユニット・コンポーネントテスト。v13はReact 19対応でasync API                                                                 |
| MSW (Mock Service Worker)                             | APIモッキング                                                                                                                |
| Detox                                                 | E2Eテスト                                                                                                                    |
| react-native-health-connect v3                        | Health Connect経由の睡眠データ取得（GMS端末のみ）                                                                            |
| react-native-android-widget v0.20                     | ホーム画面ウィジェット                                                                                                       |
| ESLint v9 + @react-native/eslint-config (flat config) | Linter。v8はEOL。flat config対応                                                                                             |
| Prettier v3.8                                         | フォーマッタ                                                                                                                 |

**WebViewは一切使用しない。GMS(Google Mobile Services)不要で動作する設計。**

### 実際にインストールされたバージョン（2026-02-25時点）

```txt
dependencies:
  @date-fns/tz                        1.4.1
  @notifee/react-native               9.1.8
  @react-native-async-storage         3.0.1
  @react-native-community/slider      5.1.2
  @react-native-google-signin         16.1.1
  @react-navigation/bottom-tabs       7.14.0
  @react-navigation/native            7.1.28
  @react-navigation/native-stack      7.13.0
  date-fns                            4.1.0
  i18next                             25.8.13
  jotai                               2.18.0
  react                               19.2.3
  react-i18next                       16.5.4
  react-native                        0.84.0
  react-native-android-widget         0.20.1
  react-native-app-auth               8.1.0
  react-native-health-connect         3.5.0
  react-native-localize               3.7.0
  react-native-paper                  5.15.0
  react-native-reanimated             4.2.2
  react-native-safe-area-context      5.7.0
  react-native-screens                4.24.0
  react-native-shake                  6.8.3
  react-native-svg                    15.15.3
  react-native-vector-icons           10.3.0
  react-native-worklets               0.7.4

devDependencies:
  eslint                              9.39.3
  prettier                            3.8.1
  typescript                          5.9.3
  jest                                29.7.0
  @testing-library/react-native       13.3.3
  msw                                 2.12.10
```

---

## 実装進捗

| Phase | 内容                           | 状態     | 備考                                                                  |
| ----- | ------------------------------ | -------- | --------------------------------------------------------------------- |
| 1     | プロジェクトスキャフォールド   | **完了** | RN 0.84, pnpm, dir構造, theme, Providers, i18n, models, atoms         |
| 2     | カスタム時間エンジン           | **完了** | conversions.ts + formatting.ts + 32テスト全パス                       |
| -     | ライブラリバージョン監査       | **完了** | reanimated v4, slider v5, google-signin v16, eslint v9, prettier v3等 |
| 3     | ストレージ・状態管理           | **完了** | Jotai永続化, SetupScreen, settingsAtom                                |
| 4     | ナビゲーションシェル           | **完了** | Phase 1で実装済み（Bottom Tabs + Stack）                              |
| 5     | 時計機能                       | **完了** | AnalogClock(SVG), DigitalClock, TimeToggle, useCurrentTime, 51テスト  |
| 6     | アラーム基本機能               | **完了** | Notifeeスケジューラ, AlarmList/Edit/Firing画面, 73テスト              |
| 7     | アラーム解除システム           | 未着手   |                                                                       |
| 8     | 一括アラーム作成               | 未着手   |                                                                       |
| 9     | タイマー機能                   | 未着手   |                                                                       |
| 10    | プラットフォーム抽象化レイヤー | 未着手   | CalendarContract用Turbo Moduleの自前実装を含む                        |
| 11    | カレンダー連携                 | 未着手   |                                                                       |
| 12    | カレンダー予定連動アラーム     | 未着手   |                                                                       |
| 13    | 設定画面                       | 未着手   |                                                                       |
| 14    | 睡眠ログ・周期自動検出         | 未着手   |                                                                       |
| 15    | ホーム画面ウィジェット         | 未着手   |                                                                       |
| 16    | テスト・仕上げ                 | 未着手   |                                                                       |
| 17    | カレンダーデザイン改善         | 未着手   | M3 Expressive対応、複数ビュー、タイムライン、アニメーション           |
| 18    | Terraform GCPプロジェクト管理  | 未着手   | API有効化、OAuth設定、Nix統合、CI対応                                 |

### Phase 1で作成済みのファイル

- `src/app/App.tsx` — ルートコンポーネント
- `src/app/Providers.tsx` — Jotai + Paper + Navigation統合
- `src/app/theme.ts` — MD3ライト/ダークテーマ
- `src/navigation/RootNavigator.tsx` — セットアップ/メインタブ切り替え
- `src/navigation/BottomTabNavigator.tsx` — 5タブ + Paper BottomNavigation.Bar
- `src/navigation/types.ts` — ナビゲーション型定義
- `src/models/*.ts` — 全データモデル（CustomTime, Settings, Alarm, CalendarEvent, SleepSession, Timer）
- `src/atoms/*.ts` — 全Jotai atom（settings, alarm, calendar, clock, sleep, timer）
- `src/core/storage/asyncStorageAdapter.ts` — ジェネリック`createAsyncStorage<T>()`ファクトリ
- `src/core/storage/keys.ts` — AsyncStorageキー定数
- `src/core/i18n/index.ts` — i18next初期化 + 言語自動検出
- `src/core/i18n/locales/ja.json`, `en.json` — 翻訳ファイル
- `src/core/platform/types.ts` — プラットフォーム抽象化インターフェース
- `src/core/time/constants.ts` — 時間定数
- `src/features/*/screens/*.tsx` — 各タブのスタブ画面（Clock, Alarm, Calendar, Sleep, Timer, Settings）
- `eslint.config.js` — ESLint v9 flat config

### Phase 2で作成済みのファイル

- `src/core/time/conversions.ts` — `realToCustom()` / `customToReal()` 実装
- `src/core/time/formatting.ts` — `formatCustomTime()` / `formatCustomTimeShort()` / `formatCustomDay()` 実装
- `__tests__/core/time/conversions.test.ts` — 22テスト（正常系、負のday、ラウンドトリップ、各種周期長）
- `__tests__/core/time/formatting.test.ts` — 10テスト（パディング、秒表示切替、day表示）

---

## プロジェクト構造

```txt
laimelea/
├── android/                          # RN CLI生成のネイティブプロジェクト
│   └── app/src/main/
│       ├── java/com/laimelea/
│       │   ├── MainActivity.kt
│       │   ├── MainApplication.kt
│       │   └── alarm/
│       │       └── AlarmFullScreenActivity.kt
│       ├── AndroidManifest.xml
│       └── res/raw/
│           └── alarm_default.mp3
├── src/
│   ├── app/
│   │   ├── App.tsx                   # ルートコンポーネント
│   │   ├── Providers.tsx             # Jotai + Paper + Navigation
│   │   └── theme.ts                  # MD3テーマ設定
│   │
│   ├── navigation/
│   │   ├── RootNavigator.tsx         # Stack: セットアップ / メインタブ / モーダル
│   │   ├── BottomTabNavigator.tsx    # MD3 Bottom Tabs
│   │   └── types.ts                  # ナビゲーション型定義
│   │
│   ├── features/
│   │   ├── clock/
│   │   │   ├── screens/ClockScreen.tsx
│   │   │   └── components/
│   │   │       ├── AnalogClock.tsx
│   │   │       ├── DigitalClock.tsx
│   │   │       ├── CustomDayIndicator.tsx
│   │   │       └── TimeToggle.tsx
│   │   │
│   │   ├── calendar/
│   │   │   ├── screens/
│   │   │   │   ├── CalendarScreen.tsx
│   │   │   │   └── EventDetailScreen.tsx
│   │   │   └── components/
│   │   │       ├── DayView.tsx
│   │   │       ├── EventCard.tsx
│   │   │       └── CustomDayTimeline.tsx
│   │   │
│   │   ├── alarm/
│   │   │   ├── screens/
│   │   │   │   ├── AlarmListScreen.tsx
│   │   │   │   ├── AlarmEditScreen.tsx
│   │   │   │   ├── BulkAlarmScreen.tsx
│   │   │   │   └── AlarmFiringScreen.tsx
│   │   │   ├── components/
│   │   │   │   ├── AlarmCard.tsx
│   │   │   │   ├── BulkAlarmForm.tsx
│   │   │   │   └── dismissal/
│   │   │   │       ├── DismissalContainer.tsx
│   │   │   │       ├── ShakeDismissal.tsx
│   │   │   │       ├── MathDismissal.tsx
│   │   │   │       └── SimpleDismissal.tsx
│   │   │   ├── services/
│   │   │   │   ├── alarmScheduler.ts
│   │   │   │   ├── alarmSoundManager.ts
│   │   │   │   ├── bulkAlarmCreator.ts
│   │   │   │   └── calendarAlarmSync.ts    # 予定連動アラーム
│   │   │   └── strategies/
│   │   │       ├── types.ts
│   │   │       ├── registry.ts
│   │   │       ├── shakeStrategy.ts
│   │   │       ├── mathStrategy.ts
│   │   │       └── simpleStrategy.ts
│   │   │
│   │   ├── timer/
│   │   │   ├── screens/TimerScreen.tsx
│   │   │   └── components/
│   │   │       ├── CountdownTimer.tsx
│   │   │       ├── Stopwatch.tsx
│   │   │       └── TimerControls.tsx
│   │   │
│   │   ├── sleep/
│   │   │   ├── screens/
│   │   │   │   ├── SleepLogScreen.tsx           # 睡眠履歴 + 周期推定表示
│   │   │   │   └── ManualSleepEntryScreen.tsx    # 手動入力（GMS不要）
│   │   │   ├── components/
│   │   │   │   ├── SleepDriftChart.tsx           # 睡眠時刻のドリフトを視覚化
│   │   │   │   └── CycleEstimateCard.tsx         # 推定周期 + 信頼度表示
│   │   │   └── services/
│   │   │       └── cycleDetector.ts              # 線形回帰による周期推定アルゴリズム
│   │   │
│   │   ├── widget/
│   │   │   └── ClockWidget.tsx                   # ホーム画面ウィジェット
│   │   │
│   │   └── settings/
│   │       ├── screens/
│   │       │   └── SettingsScreen.tsx        # 全設定を1画面にセクション分けで表示
│   │       └── components/
│   │           ├── CycleConfigSection.tsx    # カスタム周期設定セクション
│   │           ├── GeneralSection.tsx        # 言語・テーマ・時間形式
│   │           ├── TimezoneSection.tsx       # タイムゾーン・サマータイム
│   │           ├── AlarmDefaultsSection.tsx  # アラームデフォルト設定
│   │           ├── CalendarSection.tsx       # Googleアカウント・カレンダー設定
│   │           ├── BackupSection.tsx         # バックアップ・復元
│   │           └── TimezonePickerSheet.tsx   # タイムゾーン検索用ボトムシート
│   │
│   ├── core/
│   │   ├── time/
│   │   │   ├── conversions.ts        # realToCustom / customToReal
│   │   │   ├── formatting.ts         # 表示フォーマット
│   │   │   └── constants.ts
│   │   ├── platform/                 # GMS/HMS/AOSP 抽象化レイヤー
│   │   │   ├── types.ts              # PlatformAuthService, PlatformCalendarService等のインターフェース
│   │   │   ├── detection.ts          # プラットフォーム検出(GMS/HMS/AOSP)
│   │   │   ├── factory.ts            # PlatformServices生成ファクトリ
│   │   │   ├── gms/                  # GMS実装
│   │   │   │   ├── GoogleAuthService.ts
│   │   │   │   ├── GoogleCalendarService.ts
│   │   │   │   ├── GoogleDriveBackupService.ts
│   │   │   │   └── HealthConnectSleepService.ts  # Health Connect経由の睡眠データ取得
│   │   │   ├── hms/                  # HMS実装（将来用スタブ）
│   │   │   │   ├── HuaweiAuthService.ts
│   │   │   │   └── HuaweiCalendarService.ts
│   │   │   └── aosp/                 # GMS/HMS不要のフォールバック実装
│   │   │       ├── AppAuthService.ts       # react-native-app-auth (Chrome Custom Tabs + PKCE)
│   │   │       ├── LocalCalendarService.ts # カスタムTurbo Module経由のCalendarContract読取
│   │   │       ├── LocalBackupService.ts   # ファイルエクスポート/インポート
│   │   │       └── ManualSleepService.ts   # 手動睡眠ログ（GMS不要）
│   │   ├── storage/
│   │   │   ├── asyncStorageAdapter.ts
│   │   │   └── keys.ts
│   │   ├── i18n/
│   │   │   ├── index.ts              # i18next初期化
│   │   │   └── locales/
│   │   │       ├── en.json
│   │   │       └── ja.json
│   │   └── notifications/
│   │       ├── notifeeSetup.ts
│   │       ├── backgroundHandler.ts
│   │       └── foregroundHandler.ts
│   │
│   ├── atoms/
│   │   ├── settingsAtoms.ts
│   │   ├── clockAtoms.ts
│   │   ├── alarmAtoms.ts
│   │   ├── calendarAtoms.ts
│   │   ├── sleepAtoms.ts
│   │   └── timerAtoms.ts
│   │
│   ├── models/
│   │   ├── Alarm.ts
│   │   ├── CalendarEvent.ts
│   │   ├── CustomTime.ts
│   │   ├── Settings.ts
│   │   ├── SleepSession.ts
│   │   └── Timer.ts
│   │
│   ├── hooks/
│   │   ├── useCurrentTime.ts
│   │   ├── useInterval.ts
│   │   ├── usePlatformAuth.ts        # プラットフォーム抽象化経由の認証フック
│   │   └── usePlatformServices.ts    # PlatformServicesへのアクセスフック
│   │
│   └── utils/
│       ├── math.ts                   # 計算問題生成
│       └── permissions.ts
│
├── __tests__/
│   └── core/time/
│       ├── conversions.test.ts
│       └── formatting.test.ts
│
├── index.js
├── app.json
├── tsconfig.json
└── package.json
```

features構成は2025-2026年現在も主流のアーキテクチャパターンであることを確認済み。

---

## データモデル

### CycleConfig（カスタム日周期設定）

```typescript
interface CycleConfig {
  cycleLengthMinutes: number; // 例: 1560 (26h)
  baseTimeMs: number; // カスタムDay 0の00:00:00に対応するUnixタイムスタンプ(ms)
}
```

### CustomTimeValue（カスタム時刻）

```typescript
interface CustomTimeValue {
  day: number; // カスタム日番号（baseTimeからの通算）
  hours: number; // 0 ~ (cycleLengthHours - 1)
  minutes: number; // 0-59
  seconds: number; // 0-59
}
```

### AppSettings（アプリ全体設定）

```typescript
type PlatformType = "gms" | "hms" | "aosp";

interface AppSettings {
  // --- カスタム周期 ---
  cycleConfig: CycleConfig;
  setupComplete: boolean;
  primaryTimeDisplay: "custom" | "24h";

  // --- 一般 ---
  language: string; // IETF言語タグ: 'ja', 'en', 'auto' (デバイス準拠)
  theme: "light" | "dark" | "system";
  timeFormat: "12h" | "24h"; // 24h時計側の表示形式

  // --- プラットフォーム ---
  detectedPlatform: PlatformType; // 自動検出結果

  // --- タイムゾーン ---
  timezone: string; // IANA識別子: 'Asia/Tokyo', 'auto' (デバイス準拠)
  dstHandling: "auto" | "ignore"; // auto=IANA準拠で自動処理, ignore=DST無視
  secondaryTimezone: string | null; // セカンダリタイムゾーン（世界時計用）

  // --- アラームデフォルト ---
  alarmDefaults: AlarmDefaults;

  // --- カレンダー ---
  accountEmail: string | null; // 認証済みアカウント（Google/Huawei/なし）
  calendarFirstDayOfWeek: 0 | 1 | 6; // 0=日曜, 1=月曜, 6=土曜
  defaultEventReminderMin: number; // デフォルトのイベントリマインダー（分）
  visibleCalendarIds: string[]; // 表示するカレンダーのID

  // --- バックアップ ---
  lastBackupTimestamp: number | null;
}

interface AlarmDefaults {
  dismissalMethod: DismissalMethod;
  gradualVolumeDurationSec: number; // 0=即最大音量
  snoozeDurationMin: number; // スヌーズ間隔（分）
  snoozeMaxCount: number; // 最大スヌーズ回数（0=無制限）
  vibrationEnabled: boolean; // バイブレーションのデフォルト
  volumeButtonBehavior: "snooze" | "dismiss" | "volume"; // 音量ボタンの動作
}
```

### Alarm

```typescript
type DismissalMethod = "simple" | "shake" | "math";

interface Alarm {
  id: string;
  label: string;
  enabled: boolean;
  targetTimestampMs: number; // 常に実時間Unixタイムスタンプで保存
  setInTimeSystem: "custom" | "24h";
  repeat: AlarmRepeat | null;
  dismissalMethod: DismissalMethod;
  gradualVolumeDurationSec: number; // 0=即最大音量
  snoozeDurationMin: number;
  snoozeMaxCount: number; // 最大スヌーズ回数（0=無制限）
  snoozeCount: number; // 現在のスヌーズ回数（発火時にリセット）
  autoSilenceMin: number; // 自動消音までの分数（デフォルト15分）
  soundUri: string | null;
  vibrationEnabled: boolean;
  notifeeTriggerId: string | null;
  skipNextOccurrence: boolean; // 繰り返しアラームの次回のみスキップ
  // カレンダー予定連動
  linkedCalendarEventId: string | null; // カレンダーevent IDに紐づけ
  linkedEventOffsetMs: number; // 予定開始N分前にアラーム（負=前、0=同時、正=後）
  // 追跡
  lastFiredAt: number | null; // 最後に発火した時刻
  createdAt: number;
  updatedAt: number; // 最終更新時刻（バックアップ競合解決用）
}

interface AlarmRepeat {
  type: "interval" | "weekdays" | "customCycleInterval";
  intervalMs?: number; // type='interval': 実時間間隔(ms)
  weekdays?: number[]; // type='weekdays': 実世界の曜日 0=日〜6=土
  customCycleIntervalDays?: number; // type='customCycleInterval': Nカスタム日ごと
}
```

**AlarmRepeatの補足**: `weekdays`は**実世界の曜日**を指す（仕事・社会的義務は標準カレンダーに紐づくため）。カスタム周期ベースの繰り返しは`customCycleInterval`を使用。

### CalendarEvent

```typescript
interface CalendarEvent {
  id: string;
  sourceEventId: string; // プラットフォーム側のイベントID（Google/ローカル）
  source: "google" | "local" | "huawei"; // イベントの取得元
  title: string;
  description: string;
  startTimestampMs: number;
  endTimestampMs: number;
  allDay: boolean;
  colorId: string | null;
  calendarName: string;
  calendarId: string;
}
// customStart, customEndはJotai派生atomで計算（CalendarEventには含めない）
```

### BulkAlarmParams

```typescript
interface BulkAlarmParams {
  fromHour: number;
  fromMinute: number;
  toHour: number;
  toMinute: number;
  intervalMinutes: number;
  timeSystem: "custom" | "24h";
  dismissalMethod: DismissalMethod;
  gradualVolumeDurationSec: number;
  label: string;
}
```

### SleepSession（睡眠データ）

```typescript
type SleepStageType =
  | "unknown"
  | "awake"
  | "sleeping"
  | "out_of_bed"
  | "awake_in_bed"
  | "light"
  | "deep"
  | "rem";

interface SleepStage {
  startTimestampMs: number;
  endTimestampMs: number;
  stage: SleepStageType;
}

interface SleepSession {
  id: string;
  source: "health_connect" | "manual"; // GMS端末=health_connect, AOSP=manual
  startTimestampMs: number; // 入眠時刻 (Unix ms)
  endTimestampMs: number; // 起床時刻 (Unix ms)
  stages: SleepStage[]; // 睡眠ステージ（手動入力時は空配列）
  durationMs: number;
  createdAt: number;
  updatedAt: number;
}
```

### CycleEstimation（周期推定結果）

```typescript
interface CycleEstimation {
  periodMinutes: number; // 推定周期長（分）
  driftMinutesPerDay: number; // 1日あたりのドリフト（分）
  r2: number; // 決定係数（0-1、フィットの良さ）
  confidence: "low" | "medium" | "high";
  dataPointsUsed: number;
}
```

---

## 睡眠ログ・周期自動検出

### データソース

| 環境     | ソース         | 方式                                                                                               |
| -------- | -------------- | -------------------------------------------------------------------------------------------------- |
| GMS端末  | Health Connect | `react-native-health-connect`でSleepSession読取。Mi Band→Zepp Life→Health Connect→アプリの順で同期 |
| AOSP端末 | 手動入力       | ユーザーが入眠/起床時刻を手動記録                                                                  |

### Mi Band / Xiaomiウェアラブル連携

Mi Bandに公開APIは存在しない。以下の経路で間接的にデータを取得:

```txt
Mi Band → Zepp Life(Mi Fitness)アプリ → Health Connect → Laimelea
```

ユーザーがZepp LifeアプリでHealth Connect同期を有効化する必要あり。

### 周期自動検出アルゴリズム

**線形回帰**で入眠時刻のドリフトから周期を推定:

1. 入眠時刻を時系列で収集
2. 真夜中をまたぐケースを「アンラップ」（+1440分して単調増加を維持）
3. 線形回帰: `入眠時刻 = slope × 日数 + intercept`
4. `slope` = 1日あたりのドリフト（分）
5. `周期 = 1440 + slope`（分）
6. R²で信頼度を判定

**必要データ量**:

- 最低7日: 粗い推定（confidence=low）
- 14日以上: 中程度の推定（confidence=medium）
- 28日以上: 高信頼度（confidence=high、時計を1周する分のデータ）

### UI

- **SleepLogScreen**: 睡眠履歴の一覧 + ドリフトチャート（ラスタープロット）
- **CycleEstimateCard**: 推定周期・信頼度・ドリフト量を表示。「この周期を適用」ボタンでcycleConfigを自動更新
- **ManualSleepEntryScreen**: GMS不要の手動入力画面

### Health Connect の注意点

- **GMS必須**: Health ConnectはGMS端末でのみ動作
- **権限**: `android.permission.health.READ_SLEEP`が必要
- **Google Play審査**: Health Connect利用にはHealth Connect declaration formの提出が必要（約7日）
- **画面ロック必須**: Health Connectはデータ保護のためデバイスの画面ロック設定を要求

---

## ホーム画面ウィジェット

`react-native-android-widget`を使用。ネイティブコード不要でReact Componentとしてウィジェットを実装。

### 表示内容

- カスタム時間（デジタル表示）
- カスタム日番号
- 次のアラーム時刻（カスタム時間 + 実時間）

### 更新方式

- 1分ごとに自動更新（`android:updatePeriodMillis`）
- アラーム設定変更時にも更新をトリガー

---

## 核心設計：カスタム時間変換

すべての時刻は**実時間Unixタイムスタンプ**で保存。カスタム時間は表示用の派生値。

```txt
realToCustom(realTimestampMs, config) -> CustomTimeValue
  elapsedMs = realTimestampMs - baseTimeMs
  day = floor(elapsedMs / cycleLengthMs)
  remainder = elapsedMs - day * cycleLengthMs  // 常に非負
  hours = floor(remainder / 3600000)
  minutes = floor((remainder % 3600000) / 60000)
  seconds = floor((remainder % 60000) / 1000)

customToReal(customTime, config) -> number (Unix ms)
  totalMs = day * cycleLengthMs + hours*3600000 + minutes*60000 + seconds*1000
  return baseTimeMs + totalMs
```

### 設計上の重要ポイント

- **baseTimeMs以前の時刻**: `Math.floor`で負のday番号を正しく計算。remainderは`elapsedMs - day * cycleLengthMs`で常に非負
- **端数周期**: 分単位で管理するため26h30m (1590分) なども対応可能
- **アラームスケジューリング**: カスタム時間で設定されたアラームも即座に実時間に変換して保存・スケジュール

---

## アラーム解除システム（Strategy Pattern）

拡張可能な設計。新しい解除方法の追加は3ステップ：

1. `DismissalStrategy`インターフェースを実装
2. 解除UIコンポーネントを作成
3. レジストリに登録

```typescript
// Strategy インターフェース
interface DismissalStrategy {
  id: string;
  displayName: string;
  description: string;
  icon: string; // Material Design Icons名
  Component: FC<{
    onDismiss: () => void;
    onSnooze: () => void;
    difficulty: number;
  }>;
}

// レジストリ（シングルトン）
class DismissalStrategyRegistry {
  private strategies = new Map<string, DismissalStrategy>();
  register(strategy: DismissalStrategy): void;
  get(id: string): DismissalStrategy | undefined;
  getAll(): DismissalStrategy[];
}
```

初期実装する解除方法：

- **Simple**: タップで解除（フォールバック）
- **Shake**: スマホを振る（react-native-shake使用）
- **Math**: 計算問題を解く（難易度可変）

### 拡張例

新しい解除方法（例: QRコードスキャン）の追加手順：

1. `src/features/alarm/strategies/qrCodeStrategy.ts` を作成
2. `src/features/alarm/components/dismissal/QrCodeDismissal.tsx` を作成
3. 登録関数に `dismissalRegistry.register(qrCodeStrategy)` を追加
4. `DismissalMethod`型に `'qrcode'` を追加

既存の `DismissalContainer` や `AlarmFiringScreen` の変更は不要。

---

## カレンダー予定連動アラーム

### 仕組み

- カレンダーの予定に対して「この予定の N分前にアラームを鳴らす」と設定
- Google Calendar同期時に予定の時刻変更を検出し、連動アラームの`targetTimestampMs`を自動更新
- `Alarm.linkedCalendarEventId`と`Alarm.linkedEventOffsetMs`で紐づけ

### サービス: `calendarAlarmSync.ts`

```txt
syncCalendarAlarms(events, alarms, config):
  1. linkedCalendarEventIdが設定されたアラームを取得
  2. 各アラームの紐づき予定を検索
  3. 予定の開始時刻 + offset から新しいtargetTimestampMsを計算
  4. 変更があればアラームを更新し再スケジュール
  5. 削除された予定のアラームはユーザーに通知
```

### UI

- カレンダーの`EventCard`に「アラーム設定」ボタン追加
- アラーム編集画面で「カレンダー予定に連動」オプション
- アラーム一覧で連動アラームにはカレンダーアイコン表示

---

## 設定画面の設計

**方針**: 設定は**1画面（SettingsScreen）にセクション分けで表示**。スクロールで全設定にアクセス。タイムゾーン選択のみ検索UIが必要なためボトムシートを使用。画面遷移を最小化。

react-native-paper v5の`List.Section`、`List.Item`、`Switch`、`RadioButton`、`SegmentedButtons`を活用し、カスタムUIを極力排除。

### SettingsScreen レイアウト

```txt
┌─────────────────────────────────────┐
│ ⚙️ 設定                              │
├─────────────────────────────────────┤
│ ▼ カスタム周期                        │
│   周期長           [26] 時間 [00] 分  │
│   基準時刻         2026-02-25 08:00   │
│   メイン表示       [カスタム] / [24h]  │
├─────────────────────────────────────┤
│ ▼ 一般                               │
│   言語             自動(日本語)    >   │
│   テーマ           [ライト][ダーク][自動]│
│   時間形式         [12h] / [24h]      │
├─────────────────────────────────────┤
│ ▼ タイムゾーン                        │
│   タイムゾーン     Asia/Tokyo      >   │ → ボトムシート(検索付き)
│   サマータイム     [自動] / [無視]     │
│   セカンダリTZ     未設定          >   │ → ボトムシート
├─────────────────────────────────────┤
│ ▼ アラームデフォルト                   │
│   解除方法         シェイク        >   │
│   音量漸増         ━━━━●━━ 30秒       │
│   スヌーズ間隔     5分                 │
│   スヌーズ上限     3回                 │
│   バイブレーション [ON]                │
│   音量ボタン       [スヌーズ][解除][音量]│
├─────────────────────────────────────┤
│ ▼ カレンダー                          │
│   アカウント連携   user@gmail.com [切断]│
│   週の開始日       [日][月][土]        │
│   デフォルトリマインダー  15分前       │
│   表示カレンダー   ☑個人 ☑仕事 ☐祝日  │
├─────────────────────────────────────┤
│ ▼ バックアップ                        │
│   [バックアップ]   [復元]              │
│   最終バックアップ: 2026-02-24 15:30   │
└─────────────────────────────────────┘
```

### UIコンポーネント対応表

| 設定             | 使用するPaperコンポーネント                                          |
| ---------------- | -------------------------------------------------------------------- |
| セクション見出し | `List.Section`                                                       |
| 各設定項目       | `List.Item`                                                          |
| ON/OFF切替       | `Switch` (List.Itemのright prop)                                     |
| 2〜3択選択       | `SegmentedButtons`                                                   |
| スライダー       | react-native-paperには無いため`@react-native-community/slider`を使用 |
| タイムゾーン選択 | `BottomSheet` + `Searchbar` + `List`                                 |
| 数値入力         | `TextInput` (mode="outlined", keyboardType="numeric")                |
| Googleアカウント | `List.Item` + `Button`                                               |
| チェックリスト   | `Checkbox.Item`                                                      |

### 画面数の削減結果

- **変更前**: SettingsScreen + CycleConfigScreen + GoogleAccountScreen + LanguageScreen + TimezoneScreen + AlarmDefaultsScreen + BackupScreen = **7画面**
- **変更後**: **SettingsScreen 1画面** + TimezonePickerSheet(ボトムシート) = **実質1画面**

### 技術的補足

- **タイムゾーン**: IANA識別子で管理。`@date-fns/tz`の`TZDate`クラスで表示。カスタム時間はUTCタイムスタンプの差分計算のためDST非依存
- **サマータイム**: auto=IANAルールで自動処理。ignore=常に標準時で表示
- **バックアップ**: Google Drive appDataFolder API使用。独自サーバー不要（既存のGoogle Sign-Inにスコープ`drive.appdata`追加）
- **Android自動バックアップ**: `android:allowBackup="true"`で再インストール時に自動復元

---

## プラットフォーム抽象化レイヤー (GMS/HMS/AOSP)

### 設計方針

アラーム・通知機能はAOSP APIのみ使用しGMS不要。GMS依存は**認証・カレンダー同期・バックアップ**の3機能のみ。これらをインターフェースで抽象化し、GMS/HMS/AOSPの3実装を切り替える。

### インターフェース定義 (`src/core/platform/types.ts`)

```typescript
type PlatformType = "gms" | "hms" | "aosp";

interface AuthResult {
  email: string;
  accessToken: string;
  idToken?: string;
}

interface PlatformAuthService {
  signIn(): Promise<AuthResult>;
  signOut(): Promise<void>;
  getAccessToken(): Promise<string | null>;
  isAvailable(): Promise<boolean>;
}

interface CalendarInfo {
  id: string;
  name: string;
  color: string | null;
  isPrimary: boolean;
}

interface PlatformCalendarService {
  fetchEvents(startMs: number, endMs: number): Promise<CalendarEvent[]>;
  getCalendarList(): Promise<CalendarInfo[]>;
  isAvailable(): Promise<boolean>;
}

interface PlatformBackupService {
  backup(data: string): Promise<void>;
  restore(): Promise<string | null>;
  getLastBackupTime(): Promise<number | null>;
  isAvailable(): Promise<boolean>;
}

interface PlatformSleepService {
  fetchSleepSessions(startMs: number, endMs: number): Promise<SleepSession[]>;
  isAvailable(): Promise<boolean>;
}

interface PlatformServices {
  type: PlatformType;
  auth: PlatformAuthService;
  calendar: PlatformCalendarService;
  backup: PlatformBackupService;
  sleep: PlatformSleepService;
}
```

### プラットフォーム検出 (`src/core/platform/detection.ts`)

```typescript
async function detectPlatform(): Promise<PlatformType> {
  // 1. GMS利用可能か確認
  try {
    const gmsAvailable = await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: false,
    });
    if (gmsAvailable) return "gms";
  } catch {}

  // 2. HMS利用可能か確認（将来用）
  // try {
  //   const hmsAvailable = await HmsAvailability.isHuaweiMobileServicesAvailable();
  //   if (hmsAvailable === 0) return 'hms';
  // } catch {}

  // 3. フォールバック: AOSP
  return "aosp";
}
```

### 各実装の概要

|                  | GMS実装                                         | HMS実装（将来）                     | AOSP実装（フォールバック）                          |
| ---------------- | ----------------------------------------------- | ----------------------------------- | --------------------------------------------------- |
| **認証**         | `@react-native-google-signin/google-signin` v16 | `@hmscore/react-native-hms-account` | `react-native-app-auth` (Chrome Custom Tabs + PKCE) |
| **カレンダー**   | Google Calendar REST API v3                     | CalendarContract (AOSP)             | CalendarContract (AOSP) via カスタムTurbo Module    |
| **バックアップ** | Google Drive appDataFolder API                  | Huawei Drive / ローカル             | ファイルエクスポート/インポート                     |
| **睡眠データ**   | Health Connect (`react-native-health-connect`)  | 手動入力                            | 手動入力                                            |

### GMS不要の機能（変更なし）

- アラーム: `@notifee/react-native` → AlarmManager (AOSP)
- 通知: NotificationManager (AOSP)
- タイマー/ストップウォッチ: 純JavaScript
- カスタム時間計算: 純JavaScript
- UI/ナビゲーション: react-native-paper + React Navigation

### AOSP実装の認証フロー

ユーザーが「アカウント連携」をタップ
→ react-native-app-auth でChrome Custom Tabsを開く
→ GoogleのOAuth2エンドポイントにPKCEでリクエスト
→ ユーザーがGoogleアカウントで認証
→ アクセストークン取得（GMS不要）
→ Google Calendar REST API / Google Drive APIを通常通り呼び出し

### Google OAuth2 Granular Consent対応

Google OAuth2ではユーザーがスコープを個別に拒否可能。対応方針:

- 認証後に付与されたスコープを確認
- `calendar.readonly`拒否時: カレンダー機能を無効化し、ローカルカレンダー（CalendarContract）へのフォールバックを提案
- `drive.appdata`拒否時: バックアップ機能を無効化し、ファイルエクスポートを提案
- 各機能使用時にスコープ未付与なら再認証を案内

---

## Notifee アラームスケジューリング

```typescript
// TimestampTrigger + AlarmManager
const trigger = {
  type: TriggerType.TIMESTAMP,
  timestamp: alarm.targetTimestampMs,
  alarmManager: { allowWhileIdle: true },
};

// フルスクリーン通知（アプリが閉じていても画面を表示）
android: {
  channelId: 'alarm',
  category: AndroidCategory.ALARM,
  fullScreenAction: {
    id: 'alarm-fullscreen',
    launchActivity: 'com.hayao0819.laimelea.alarm.AlarmFullScreenActivity',
  },
  loopSound: true,
}
```

### 必要なAndroid権限

```xml
USE_EXACT_ALARM                  <!-- アラームアプリとして自動付与（SCHEDULE_EXACT_ALARMより適切） -->
USE_FULL_SCREEN_INTENT           <!-- アラームアプリとして自動付与。canUseFullScreenIntent()で確認し、不可時はheads-up通知にフォールバック -->
VIBRATE
RECEIVE_BOOT_COMPLETED           <!-- デバイス再起動後のアラーム再スケジュール -->
FOREGROUND_SERVICE
POST_NOTIFICATIONS               <!-- Android 13+ -->
READ_CALENDAR                    <!-- AOSP CalendarContract経由のカレンダー読取（GMS不要） -->
```

**注**: `SCHEDULE_EXACT_ALARM`は使用しない。アラームアプリとして`USE_EXACT_ALARM`を使用することで、ユーザーに手動で権限付与を求める必要がなくなる。Google Play審査でアラームアプリとして認定される必要がある。

---

## 音量の段階的増加

`GradualVolumeManager`クラスが500msごとに音量を線形に増加：

- `durationSec=0`: 即座に最大音量
- `durationSec=30`: 30秒かけて0→最大に増加

---

## カレンダー連携

プラットフォーム抽象化レイヤー経由で動作。カレンダーソースは自動検出:

| 環境     | 認証方式                     | カレンダーソース                                    |
| -------- | ---------------------------- | --------------------------------------------------- |
| GMS端末  | Google Sign-In               | Google Calendar REST API v3                         |
| HMS端末  | Huawei Account Kit（将来）   | CalendarContract (AOSP)                             |
| AOSP端末 | AppAuth (Chrome Custom Tabs) | Google Calendar REST API v3 または CalendarContract |

- **API**: Google Calendar REST API v3 を`fetch`で直接呼び出し（WebView不使用、GMS不要）
- **ローカルフォールバック**: CalendarContract (AOSP) 経由でデバイス上のカレンダーを読取。DAVx5等でGoogleカレンダーと同期可能
- **同期戦略**: アプリフォアグラウンド時に前後2週間分を取得、5分間キャッシュ、プルトゥリフレッシュ
- **同期のmutex**: カレンダー同期処理は排他ロックで保護し、同時実行による競合を防止

---

## ナビゲーション構造

```txt
RootNavigator (NativeStack)
├── SetupScreen           # 初回起動ウィザード
├── MainTabs (@react-navigation/bottom-tabs + Paper BottomNavigation.Bar)
│   ├── ClockTab    → ClockScreen
│   ├── AlarmTab    → AlarmListScreen
│   ├── CalendarTab → CalendarScreen
│   ├── SleepTab    → SleepLogScreen
│   └── TimerTab    → TimerScreen
├── AlarmEditScreen       # モーダル
├── BulkAlarmScreen       # モーダル
├── EventDetailScreen     # モーダル
├── SettingsScreen        # 全設定を1画面にセクション表示（スクロール）
└── AlarmFiringScreen     # フルスクリーン（Notifee起動）
```

---

## 実装フェーズ

### Phase 1: プロジェクトスキャフォールド ✅ 完了

- `npx @react-native-community/cli init Laimelea` (RN 0.84, TypeScriptデフォルト)
- pnpmに切替（`.npmrc`に`node-linker=hoisted`）
- 全依存ライブラリのインストール + バージョン監査・アップグレード
- MD3テーマ設定（ライト/ダーク）、Providers構成（Paper + Navigation + Jotai）
- ディレクトリ構造作成（features/, core/, atoms/, models/, hooks/, utils/）
- 全データモデル・Jotai atom・i18n（ja/en）・プラットフォーム抽象化型定義を実装
- 5タブナビゲーション（Clock/Alarm/Calendar/Sleep/Timer）+ スタブ画面
- ESLint v9 flat config (`eslint.config.js`) 設定
- **Android SDKセットアップ・ビルド確認は未実施**（環境依存のため後回し）

### Phase 2: カスタム時間エンジン ✅ 完了

- `src/core/time/conversions.ts` - `realToCustom()` / `customToReal()` 実装
- `src/core/time/formatting.ts` - `formatCustomTime()` / `formatCustomTimeShort()` / `formatCustomDay()` 実装
- `src/core/time/constants.ts` - 時間定数
- `src/models/CustomTime.ts`, `Settings.ts` - データモデル + デフォルト値
- **32テスト全パス**（負のday、ラウンドトリップ変換、24h/26h/28h/26.5h各周期）

### Phase 3: ストレージ・状態管理 ✅ 完了

- AsyncStorageアダプター + Jotai atomWithStorage
- `settingsAtoms.ts` - 周期設定の永続化 + 派生atom（`cycleConfigAtom`, `setupCompleteAtom`）
- 初回セットアップ画面（`SetupScreen` — 周期長 + 基準時刻設定 + ライブプレビュー）
- RootNavigatorが`setupCompleteAtom`で初回起動を判定
- **41テスト全パス**（既存32 + 派生atom 4 + SetupScreen 5）

### Phase 4: ナビゲーションシェル

- Bottom Tab Navigator（5タブ）
- RootNavigator（条件付き初期ルート）
- 全スクリーンのスタブ作成

### Phase 5: 時計機能

- `useCurrentTime`フック（毎秒更新）
- DigitalClock（カスタム時間 / 24h切り替え）
- AnalogClock（SVG描画、カスタム周期対応の時間マーカー）
- CustomDayIndicator

### Phase 6: アラーム基本機能

- Notifeeセットアップ（チャンネル、権限）
- アラームスケジューラ
- アラーム一覧 / 編集画面
- バックグラウンド・フォアグラウンドハンドラ
- AlarmFullScreenActivity (Kotlin)

### Phase 7: アラーム解除システム ✅

- Strategy Pattern + Registry実装（`strategies/types.ts`, `registry.ts`, `index.ts`）
- SimpleDismissal（タップ解除）/ ShakeDismissal（シェイク3回）/ MathDismissal（計算問題）
- DismissalContainer（戦略ルーティング + simple fallback）
- AlarmFiringScreen リファクタリング（DismissalContainer統合）
- AlarmEditScreen（解除方法選択Dialog追加）
- GradualVolumeManager（音量段階的増加タイマー）
- mathProblemGenerator（難易度別問題生成）
- 38テスト追加（合計111テスト）

### Phase 8: 一括アラーム作成

- BulkAlarmForm（from/to/interval入力）
- bulkAlarmCreator.ts
- プレビュー付きBulkAlarmScreen

### Phase 9: タイマー機能

- CountdownTimer + Stopwatch
- ドリフト補正付きフック
- 完了時の通知

### Phase 10: プラットフォーム抽象化レイヤー

- `PlatformAuthService`, `PlatformCalendarService`, `PlatformBackupService` インターフェース定義（Phase 1で型のみ作成済み）
- プラットフォーム検出ロジック
- GMS実装（Google Sign-In v16 + Calendar REST API + Drive backup）
- AOSP実装（AppAuth + **カスタムTurbo Module for CalendarContract** + ファイルエクスポート）
  - `react-native-calendar-events`は5年間未更新でNew Architecture非対応のため、CalendarContract読取はKotlin Turbo Moduleとして自前実装
- ファクトリ + Jotai atomでサービスインスタンス管理

### Phase 11: カレンダー連携 ✅ 完了

- Google Calendar REST API クライアント (`googleCalendarApi.ts`)
- OAuth認証フロー（GMS: GoogleSignin / AOSP: AppAuth + PKCE）
- CalendarScreen MVP（DaySelector + EventCard + EventDetailScreen）
- CalendarContract Turbo Module（Kotlin、AOSP向け）
- キャッシュレイヤー + 同期mutex (`useCalendarSync`)
- カレンダーリスト同期、表示カレンダーフィルタリング

### Phase 12: カレンダー予定連動アラーム ✅ 完了

- `calendarAlarmSync.ts`（予定変更時のアラーム自動更新、予定削除時のアラーム無効化）
- CalendarScreen sync 後に linked alarms の時刻自動更新
- EventCardへのアラーム設定UI + AlarmCard バッジ

### Phase 13: 設定画面 ✅ 完了

- 周期長変更（アラーム再計算警告付き）
- 基準時刻リセット
- アラームデフォルト設定（6項目）
- カレンダー設定（アカウント、表示カレンダー、リマインダー、週開始日）
- バックアップ/復元（アラーム+設定+睡眠データ → JSON シリアライズ、ローカルストレージ）

### Phase 14: 睡眠ログ・周期自動検出 ✅ 完了

- GMS実装: `HealthConnectSleepService`（react-native-health-connect）
- AOSP実装: `ManualSleepService`（手動入力CRUD）
- 周期推定アルゴリズム: `cycleDetector.ts`（線形回帰、R²、信頼度）
- SleepLogScreen（useSleepSync hook 統合、pull-to-refresh、auto-sync）
- SleepDriftChart（SVG 散布図）+ CycleEstimateCard（適用ボタン付き）
- ManualSleepEntryScreen（作成/編集、バリデーション）

### Phase 15: ホーム画面ウィジェット ✅ 完了

- `react-native-android-widget`セットアップ + ClockWidgetProvider（Kotlin）
- ClockWidget（カスタム時間 + Day + 24h + 次のアラーム）
- WidgetTaskHandler（headless task）
- `requestClockWidgetUpdate()` をアラーム/設定変更時に呼び出し

### Phase 16: テスト・仕上げ ✅ 完了

- ユニットテスト: 67 suites, 551 tests all passing
- E2Eテスト: calendar, sleep, settings 追加（既存: alarm, clock, navigation, setup, timer）
- アクセシビリティ対応: 27ファイルに accessibilityLabel/Role/State 追加
- 残タスク: アプリアイコン・スプラッシュ画面、Android 12-15実機テスト

### Phase 17: カレンダーデザイン改善

現状のCalendarScreenは単一のリストビュー（DaySelector + FlatList）のみで、Chipベースの日付選択と基本的なEventCardで構成されている。2025-2026年のカレンダーUI/UXトレンドを反映し、モダンなデザインに刷新する。

#### 17a: 複数ビューの導入

現在は日付選択 + イベントリストのみ。以下の3ビューを追加し、SegmentedButtonで切り替え可能にする。

- **月ビュー（MonthView）**: 7列グリッドレイアウト。日付セルは角丸の個別カードとして分離（Google Calendar M3 Expressive風）。イベントはドットインジケーターで表示し、タップでアジェンダに展開。現在日はprimaryカラーの塗りつぶし円。テーマのDynamic Colorを背景に適用
- **週ビュー（WeekView）**: 7列 × 時間軸の縦スクロールグリッド。イベントを時間ブロック（高さ＝所要時間に比例した色付き矩形）で表示。重なりはブロック幅を縮小して並列配置。現在時刻を赤/アクセント色の横線（nowインジケーター）で表示。終日イベントは上部ストリップに表示
- **アジェンダビュー（AgendaView）**: 日別グループヘッダー付きの時系列イベントリスト。無限スクロール対応。リッチなEventCardで時間・タイトル・場所・カレンダー色を表示。現在の「CalendarScreen + DaySelector」の改良版

ビュー切り替えはreact-native-paperの`SegmentedButtons`を使用。選択状態はJotai atomで永続化。

#### 17b: EventCard デザイン刷新

現在のEventCardはoutlined Cardに小さなcolorDot（12×12px）のみ。以下の改善を行う。

- **色付き左ボーダーストライプ**: 12pxドットを4px幅の左端ボーダーに変更（Google Calendar/Fantastical標準パターン）。Card背景はカレンダー色の薄いtint（opacity 0.08）に
- **時間表示の改善**: 開始〜終了時間を表示（例: `10:30 - 11:30`）。カスタム時間はサブテキストとして。所要時間バッジ追加（Chip: `1h`, `30m`等）
- **場所表示**: `event.location`がある場合、mapピンアイコン付きで表示
- **視覚的優先度**: 直近のイベント（1時間以内）は微妙なelevation/shadowで強調
- **終日イベント**: 背景を薄いカレンダー色で塗りつぶしたフルワイドChipに変更

#### 17c: DaySelector → ミニカレンダーヘッダー

現在のChipベースの横スクロールを改善。

- **月ビュー時**: 月グリッドがメインコンテンツなのでDaySelectorを非表示にし、月/年タイトルと前後ナビゲーション矢印のみ表示
- **週/アジェンダビュー時**: コンパクトな週カレンダーストリップ。各日セルに曜日（短縮）+ 日付番号。選択日はprimaryカラー円。イベントありの日はドットインジケーター表示。スワイプで週送り対応
- **「今日」ボタン**: FABスタイルの小型ボタンに変更、右下に固定配置

#### 17d: タイムラインビュー（CustomDayTimeline）

設計ドキュメントにあるCustomDayTimelineを本実装する。

- **カスタム時間軸**: 24h時間軸ではなくカスタム周期（例: 26h）に基づくタイムライン。`realToCustom()`で変換した時間軸上にイベントブロックを配置
- **実時間/カスタム時間のデュアル表示**: 左側に実時間ラベル、右側にカスタム時間ラベル
- **nowインジケーター**: 現在時刻を赤い横線で表示、1分ごとに自動更新
- **スクロール**: 現在時刻付近に自動スクロール。上下スワイプで時間軸移動

#### 17e: アニメーション・マイクロインタラクション

react-native-reanimated v4を活用したスムーズなトランジション。

- **ビュー切り替え**: crossFade（200-300ms）でビュー間のシームレスな切り替え
- **日付選択**: 月ビューで日付タップ時、選択円のスプリングアニメーション
- **イベントカード**: タップ時のプレス効果（scale 0.98 + opacity変化）。展開時のlayout animation
- **スワイプナビゲーション**: 月/週の左右スワイプに物理ベースのデセラレーションカーブ適用
- **Pull-to-refresh**: カスタムアニメーション付きリフレッシュインジケーター

#### 17f: ダークモード最適化

現在のカレンダー画面のダークモード対応を強化。

- **イベントカラー**: ダーク背景上での可読性を確保するため、イベント色のsaturationとluminanceを自動調整するユーティリティ関数作成
- **表面レベルのトーナルエレベーション**: 純黒ではなくsurface/surfaceContainerのM3トークンを使用
- **コントラスト比**: テキスト/背景のコントラスト比がWCAG AA（4.5:1）以上を維持

#### 作成/変更対象ファイル

```txt
src/features/calendar/
├── screens/
│   └── CalendarScreen.tsx          # ビュー切り替えロジック追加
├── components/
│   ├── DaySelector.tsx             # ミニカレンダーヘッダーに刷新
│   ├── EventCard.tsx               # 左ボーダー・時間範囲・場所表示
│   ├── MonthView.tsx               # 新規: 月グリッドビュー
│   ├── WeekView.tsx                # 新規: 週タイムグリッド
│   ├── AgendaView.tsx              # 新規: アジェンダリスト
│   ├── CustomDayTimeline.tsx       # 既存スタブを本実装
│   ├── TimelineEventBlock.tsx      # 新規: タイムライン上のイベントブロック
│   └── NowIndicator.tsx            # 新規: 現在時刻インジケーター
├── hooks/
│   └── useCalendarView.ts          # 新規: ビュー状態管理
└── utils/
    └── eventColorUtils.ts          # 新規: ダークモード色補正

src/atoms/
└── calendarAtoms.ts                # calendarViewModeAtom追加
```

#### デザイン参考

- Google Calendar M3 Expressive: 角丸セル分離、Dynamic Color背景、Google Sans Flex
- Fantastical: 月グリッド + アジェンダリストのハイブリッド、Calendar Sets
- Apple Calendar: 微妙なシェーディング、現在時刻のアンビエント表示
- Timepage: ヒートマップ型月ビュー（忙しさの視覚化）
- Material Design 3: Date Picker states、トーナルエレベーション、16dpグリッド

### Phase 18: Terraform GCPプロジェクト管理

Google Cloud上のプロジェクトをTerraformでIaC管理し、アプリのOAuth2認証を動作可能にする。現在のauthConfigにはプレースホルダ（`__GOOGLE_OAUTH_CLIENT_ID__`, `__GOOGLE_WEB_CLIENT_ID__`）が入っており、実際のGoogle Cloudプロジェクトが未設定。

#### Terraformの管理範囲と制約

2025年9月に`google_iap_brand`（OAuth同意画面）が廃止され、標準のOAuth 2.0 Client ID（Android/Web型）にはTerraformリソースが存在しない（Google側にREST APIが非公開）。そのため、Terraformで管理できる範囲と手動設定が必要な範囲を明確に分離する。

| 項目                       | 管理方法                    | Terraformリソース           |
| -------------------------- | --------------------------- | --------------------------- |
| GCPプロジェクト作成        | Terraform                   | `google_project`            |
| API有効化                  | Terraform                   | `google_project_service`    |
| サービスアカウント         | Terraform                   | `google_service_account`    |
| IAMバインディング          | Terraform                   | `google_project_iam_member` |
| Terraformステートバケット  | Terraform                   | `google_storage_bucket`     |
| OAuth同意画面              | 手動（gcloudまたはConsole） | なし（廃止済み）            |
| OAuth Client ID（Web）     | 手動（gcloudまたはConsole） | なし（API非公開）           |
| OAuth Client ID（Android） | 手動（gcloudまたはConsole） | なし（API非公開）           |

#### 18a: Nix開発環境にTerraform追加

`flake.nix`にTerraformとGoogle Cloudプロバイダーを追加。

- `terraform.withPlugins`でGoogleプロバイダーをバンドル（プロバイダーダウンロード不要の完全再現可能な環境）
- `google-cloud-sdk`（gcloud CLI）も追加。OAuth Client ID作成等のTerraform非対応操作に使用
- Terraform BSLライセンスのため`config.allowUnfree = true`は既に設定済み
- 既存のdefault devShellに統合（`commonPackages`に追加）

```nix
# flake.nix への追加イメージ
terraform = pkgs.terraform.withPlugins (p: [
  p.google       # hashicorp/google プロバイダー v7.x
  p.google-beta  # beta リソース用（必要時）
  p.null         # null_resource（手動ステップのラッパー）
  p.local        # local_file（生成ファイル出力用）
]);
```

#### 18b: Terraformプロジェクト構成

`infra/` ディレクトリをプロジェクトルートに作成し、GCPリソースを管理。

```txt
infra/
├── main.tf              # プロバイダー設定、バックエンド設定
├── project.tf           # GCPプロジェクト作成
├── apis.tf              # API有効化（Calendar, People, IAM等）
├── variables.tf         # 変数定義（project_id, region, support_email等）
├── outputs.tf           # 出力値（project_number, 手動設定ガイド等）
├── terraform.tfvars.example  # 変数テンプレート（.gitignore対象の.tfvarsのコピー）
└── README.md            # セットアップ手順（OAuth手動設定含む）
```

#### 18c: 管理するGCPリソース

**プロジェクト作成:**

```hcl
resource "google_project" "laimelea" {
  name       = "Laimelea"
  project_id = var.project_id
  org_id     = var.org_id  # optional
}
```

**API有効化:**

- `calendar-json.googleapis.com` — Google Calendar API
- `people.googleapis.com` — People API（ユーザー情報取得）
- `iamcredentials.googleapis.com` — IAM Credentials（サービスアカウントトークン）
- `cloudresourcemanager.googleapis.com` — Resource Manager

```hcl
resource "google_project_service" "calendar_api" {
  project            = google_project.laimelea.project_id
  service            = "calendar-json.googleapis.com"
  disable_on_destroy = false
}
```

**Terraformステート用GCSバケット（オプション）:**

```hcl
resource "google_storage_bucket" "tfstate" {
  name                        = "${var.project_id}-tfstate"
  location                    = var.region
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true
  versioning { enabled = true }
}
```

#### 18d: OAuth手動設定の自動化補助

Terraformで管理できないOAuth設定について、セットアップスクリプトとterraform outputでガイドを提供する。

**SHA-1フィンガープリント取得:**

```bash
keytool -list -v \
  -keystore android/app/debug.keystore \
  -alias androiddebugkey \
  -storepass android 2>/dev/null | grep SHA1
```

**Terraform outputs で手動設定ガイドを出力:**

```hcl
output "manual_setup_instructions" {
  value = <<-EOT
    以下の手順でOAuth Client IDを手動作成してください:

    1. OAuth同意画面を設定:
       https://console.cloud.google.com/apis/credentials/consent?project=${google_project.laimelea.project_id}

    2. Web Client ID を作成（AOSP用 + GMS用）:
       https://console.cloud.google.com/apis/credentials/oauthclient?project=${google_project.laimelea.project_id}
       - Application Type: Web application
       - Name: Laimelea Web Client

    3. Android Client ID を作成:
       - Application Type: Android
       - Package name: com.hayao0819.laimelea
       - SHA-1: (keytoolで取得した値)

    4. 取得したClient IDを以下に設定:
       - .env → GOOGLE_OAUTH_CLIENT_ID, GOOGLE_WEB_CLIENT_ID
  EOT
}
```

#### 18e: Client IDの安全な管理

プレースホルダをビルド時に環境変数から注入する仕組みを構築。Client IDはシークレットではない（APKに含まれる公開情報）が、リポジトリにハードコードしない方がベター。

- `react-native-config`パッケージで`.env`を読み込み
- authConfig.tsのプレースホルダを環境変数参照に変更

```typescript
// authConfig.ts
import Config from "react-native-config";

export const AOSP_AUTH_CONFIG: AuthConfiguration = {
  issuer: "https://accounts.google.com",
  clientId: Config.GOOGLE_OAUTH_CLIENT_ID ?? "",
  // ...
};
```

`.env.example`をリポジトリに含め、実際の`.env`は`.gitignore`対象:

```env
GOOGLE_OAUTH_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
```

#### 18f: .gitignoreとセキュリティ

```gitignore
# Terraform
infra/.terraform/
infra/*.tfstate
infra/*.tfstate.backup
infra/*.tfvars
!infra/*.tfvars.example
infra/.terraform.lock.hcl

# OAuth credentials
.env
.env.local
```

#### 作成/変更対象ファイル

```txt
infra/
├── main.tf
├── project.tf
├── apis.tf
├── variables.tf
├── outputs.tf
├── terraform.tfvars.example
└── README.md

flake.nix                               # terraform + google-cloud-sdk 追加
treefmt.nix                             # infra/ を prettier 除外に追加
.gitignore                              # Terraform + .env 追加
.env.example                            # Client ID テンプレート
src/core/platform/aosp/authConfig.ts    # react-native-config 参照に変更
src/core/platform/gms/authConfig.ts     # react-native-config 参照に変更
```

### 将来フェーズ（v1.0後）

- HMS実装（Huawei Account Kit + AppGallery配信）
- ベッドサイドクロックモード（OLED対応ダークテーマ）
- 複数同時タイマー
- Lomb-Scargle周期解析（不規則データ対応の高度な周期推定）
- react-native-vector-icons → `@react-native-vector-icons/*` スコープパッケージ移行

---

## Android固有の考慮事項

### 権限の段階的要求

| Android     | 影響                             | 対策                                                                           |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------ |
| 12 (API 31) | 正確なアラーム権限が特殊権限に   | `USE_EXACT_ALARM`使用で自動付与（アラームアプリとして）                        |
| 13 (API 33) | `POST_NOTIFICATIONS`権限が必要に | 初回起動時にランタイム権限リクエスト                                           |
| 14 (API 34) | `USE_FULL_SCREEN_INTENT`が制限   | アラームアプリとして自動付与。`canUseFullScreenIntent()`で確認しフォールバック |
| 15 (API 35) | Notifee通知の表示問題報告あり    | Android 15実機で重点テスト、フォアグラウンドサービスによるフォールバック検討   |

### Doze Mode対策

- Notifeeの`alarmManager: { allowWhileIdle: true }`で`setExactAndAllowWhileIdle()`を使用
- バッテリー最適化の除外をユーザーに案内するフローを実装
- OEM固有のバッテリーキラー対策として[dontkillmyapp.com](https://dontkillmyapp.com)への案内画面を用意

### デバイス再起動後のアラーム復旧

- `RECEIVE_BOOT_COMPLETED`権限 + BootReceiverでアプリ起動時に全アラーム再スケジュール
- Notifeeのバックグラウンドハンドラ内でAsyncStorageから有効アラームを読み取り再登録

### その他

- Androidのアラームトリガー上限は**50件**。一括アラーム作成時に上限警告を表示
- `PendingIntent`には`FLAG_IMMUTABLE`を使用（Android 12+必須、Notifeeが内部処理）
- フルスクリーンActivity: `AlarmFullScreenActivity.kt`にReact Nativeルートビューをホスト
- 通知チャンネル: `alarm`(DND回避)、`timer`(通常)、`calendar_reminder`(通常)の3つ

---

## 多言語対応 (i18n)

### 構成

- **ライブラリ**: `i18next` + `react-i18next` + `react-native-localize`
- **翻訳ファイル**: `src/core/i18n/locales/{lang}.json`（フラットキー構造）
- **ネイティブ文字列**: `android/app/src/main/res/values-{lang}/strings.xml`（通知タイトル等）

### 新言語追加手順

1. `src/core/i18n/locales/{lang}.json`を追加
2. `android/app/src/main/res/values-{lang}/strings.xml`を追加
3. コード変更不要

### 初期対応言語

- 日本語 (ja) - デフォルト
- 英語 (en)

---

## テストスタック

| レイヤー               | ツール                        | 用途                                      |
| ---------------------- | ----------------------------- | ----------------------------------------- |
| テストランナー         | Jest                          | ユニット・統合テスト実行                  |
| コンポーネントテスト   | @testing-library/react-native | ユーザー操作ベースのコンポーネントテスト  |
| APIモッキング          | MSW (Mock Service Worker)     | Google Calendar API等のネットワークモック |
| モジュールモッキング   | Jest built-in mocks           | ネイティブモジュール・タイマー等のモック  |
| スナップショットテスト | Jest snapshots (控えめに)     | 小さく安定したコンポーネントのみ          |
| カバレッジ             | Jest --coverage (Istanbul)    | カバレッジ閾値の強制                      |
| E2Eテスト              | Detox                         | エンドツーエンド受け入れテスト            |

### TDDワークフロー

1. **RED**: Jest + RNTLでテストを書く（コンポーネント）/ Jestのみ（ビジネスロジック）。MSWでAPIコントラクトを定義
2. **GREEN**: テストを通す最小限のコードを書く
3. **REFACTOR**: テストが通る状態を維持しつつコード整理
4. **Coverage Gate**: `jest --coverage`で閾値(80%)クリアを確認
5. **E2E**: Detoxで主要ユーザーフローを検証

### テスト対象の優先順位

1. `src/core/time/conversions.ts` - 時間変換ロジック（最重要、100%カバレッジ目標）
2. `src/features/alarm/services/` - アラームスケジューリング、一括作成、カレンダー連動
3. `src/features/alarm/strategies/` - 解除ストラテジーレジストリ
4. `src/atoms/` - Jotai atom（派生atom含む）
5. 各スクリーンのコンポーネントテスト

### テストディレクトリ構造

```txt
__tests__/
├── core/time/
│   ├── conversions.test.ts
│   └── formatting.test.ts
├── features/
│   ├── alarm/
│   │   ├── services/
│   │   │   ├── alarmScheduler.test.ts
│   │   │   ├── bulkAlarmCreator.test.ts
│   │   │   └── calendarAlarmSync.test.ts
│   │   └── strategies/
│   │       └── registry.test.ts
│   ├── calendar/
│   │   └── services/
│   │       └── googleCalendarApi.test.ts
│   └── clock/
│       └── screens/
│           └── ClockScreen.test.tsx
├── atoms/
│   └── settingsAtoms.test.ts
└── e2e/                    # Detox E2Eテスト
    ├── alarm.e2e.ts
    ├── clock.e2e.ts
    ├── calendar.e2e.ts
    └── timer.e2e.ts
```

---

## 検証方法

1. **時間変換**: ユニットテスト（Jest）で各種周期・エッジケースを検証（100%カバレッジ目標）
2. **アラーム**: MSWでNotifee APIをモック + Detox E2Eでアラーム設定→発火を確認
3. **カレンダー連携**: MSWでGoogle Calendar APIをモック + 実Googleアカウントでの手動テスト
4. **予定連動アラーム**: calendarAlarmSync.tsのユニットテスト + Detox E2Eで同期フロー検証
5. **一括アラーム**: bulkAlarmCreator.tsのユニットテスト（境界値、上限50件警告）
6. **解除方法**: 各Strategy（Simple/Shake/Math）のコンポーネントテスト + Detox E2E
7. **設定画面**: コンポーネントテストで各セクションの表示・操作を検証

---

## 既知の問題・リスク

### react-native-paper v5.15 + New Architecture

- react-native-paper v5.15はNew Architecture（Fabric）を**公式にはサポートしていない**
- RN 0.84はNew Architecture専用のため、Interop Layer経由で動作する前提
- 報告されているバグ: ボタン押下イベント不具合、TextInputラベル非表示、Snackbar表示問題、ProgressBarクラッシュ（GitHub #4454, #4797）
- **対策**: ビルド後に主要コンポーネントを実機テストし、問題があればUI実装をreact-native標準コンポーネントで代替

### react-native-calendar-events 代替

- 元ライブラリは5年間未更新。npm上にNew Architecture対応の代替パッケージは存在しない
- Phase 10でAndroid CalendarContract読取用のKotlin Turbo Moduleを自前実装する計画
- 代替案: Expo Calendar Module（ただしExpo依存が増える）

### react-native-vector-icons v10 非推奨

- v10は最後の単一パッケージ版。`@react-native-vector-icons/*`スコープパッケージへの移行が推奨されている
- react-native-paperがvector-iconsに依存しているため、Paper対応を確認してから移行予定
- 現時点ではv10.3.0で動作に問題なし

### eslint-plugin-ft-flow peer dependency警告

- `@react-native/eslint-config 0.84.0`が依存する`eslint-plugin-ft-flow 2.0.3`はESLint ^8.1.0を要求
- 当プロジェクトはESLint v9を使用しているためpeer dep警告が出る
- Flow未使用のため実害なし

### @testing-library/react-native v13 async API

- v13でReact 19対応のため`render()`, `fireEvent()`, `act()`が全て非同期化
- テストコードでは全て`await`が必須

### Android SDKセットアップ未完了

- 開発マシンにANDROID_HOME/JAVA_HOMEが未設定
- Android SDKセットアップ後にネイティブビルド確認が必要

---

## 開発環境

| 項目                     | バージョン                      |
| ------------------------ | ------------------------------- |
| Node.js                  | 22.18.0                         |
| pnpm                     | 10.28.1                         |
| Java (OpenJDK)           | 17.0.18                         |
| パッケージマネージャ設定 | `.npmrc`: `node-linker=hoisted` |
| OS                       | Linux (Arch) 6.18.9-zen1-2-zen  |

### pnpmの注意点

- React Native CLIは`--pm pnpm`フラグ未対応。npmで初期化後にpnpmへ切替
- Metroバンドラーはsymlinkを辿れないため、`node-linker=hoisted`が必須
- テスト実行は`npx jest <path>`を直接使用（`pnpm test -- --testPathPattern`はパターンが正しく渡らない）

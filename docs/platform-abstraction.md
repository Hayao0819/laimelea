# プラットフォーム抽象化レイヤー

GMS/HMS/AOSP を統一インターフェースで切り替える基盤。アラームと通知は AOSP API のみで動作し、GMS は不要。認証、バックアップ、睡眠データをプラットフォームごとのサービスとして切り替える。カレンダー読取は全プラットフォームで Android CalendarContract（カスタム Turbo Module）を使用し、Google Calendar REST API は使用しない。

## アーキテクチャ概要

```txt
Providers.tsx (mount)
  └─ detectPlatform()           ← GMS と端末メーカーを判定
       └─ platformTypeAtom      ← "gms" | "hms" | "aosp"
            └─ platformServicesAtom (derived)
                 └─ createPlatformServices(type)
                      ├─ aosp/ ─ authService, calendarService, backupService, sleepService
                      ├─ gms/  ─ authService, calendarService, backupService, sleepService
                      └─ hms/  ─ authService, backupService (calendar/sleep は AOSP を再利用)
```

## ディレクトリ構成

```txt
src/core/platform/
├── types.ts              # 全インターフェース定義 (PlatformServices, Auth, Calendar, Backup, Sleep)
├── detection.ts          # detectPlatform() — GoogleSignin.hasPlayServices() で GMS 検出
├── factory.ts            # createPlatformServices() — type に応じたサービス生成
├── driveBackupService.ts # GMS/HMS Driveバックアップの共通処理
├── oidcAuthService.ts    # AOSP/HMS OAuth2認証の共通処理
├── aosp/
│   ├── authService.ts    # react-native-app-auth + PKCE (Chrome Custom Tabs)
│   ├── authConfig.ts     # AOSP 用 OAuth2 設定 (issuer, redirect, scopes)
│   ├── tokenUtils.ts     # JWT id_token デコード・メール抽出
│   ├── calendarService.ts # CalendarContract Turbo Module 経由のローカルカレンダー読取
│   ├── backupService.ts  # AsyncStorage ベース backup/restore (ローカルのみ)
│   ├── sleepService.ts   # 手動睡眠入力 CRUD (AsyncStorage)
│   └── index.ts
├── gms/
│   ├── authService.ts    # @react-native-google-signin v16 wrapper (signIn/signOut/getTokens)
│   ├── authConfig.ts     # GMS 用 OAuth2 設定 (drive.appdata スコープ)
│   ├── backupService.ts  # Google Drive appDataFolder API (googleDriveApi 経由)
│   ├── sleepService.ts   # Health Connect API (react-native-health-connect)
│   └── index.ts
├── hms/
│   ├── authService.ts    # Huawei OAuth2 + PKCE
│   ├── authConfig.ts     # Huawei OAuth2 設定
│   ├── backupService.ts  # Huawei Drive appDataFolder API (huaweiDriveApi 経由)
│   └── index.ts
└── native/
    ├── NativeCalendarModule.ts  # Turbo Module spec (CalendarContract バインディング)
    └── calendarModule.ts        # Native module ブリッジ

src/core/drive/
├── googleDriveApi.ts            # Google Drive appDataFolder API クライアント
└── huaweiDriveApi.ts            # Huawei Drive appDataFolder API クライアント

__tests__/core/drive/
└── googleDriveApi.test.ts # Drive API テスト

src/atoms/
└── platformAtoms.ts      # platformTypeAtom + derived platformServicesAtom
```

## インターフェース

全サービスは `isAvailable(): Promise<boolean>` を持ち、利用可否を動的に判定できる。

| インターフェース          | メソッド                                                | 用途               |
| ------------------------- | ------------------------------------------------------- | ------------------ |
| `PlatformAuthService`     | `signIn`, `signOut`, `getAccessToken`, `isAvailable`    | OAuth 認証         |
| `PlatformCalendarService` | `fetchEvents`, `getCalendarList`, `isAvailable`         | カレンダー読取     |
| `PlatformBackupService`   | `backup`, `restore`, `getLastBackupTime`, `isAvailable` | データバックアップ |
| `PlatformSleepService`    | `fetchSleepSessions`, `isAvailable`                     | 睡眠データ取得     |

詳細な型定義は `src/core/platform/types.ts` を参照。

## 実装状況

全 Phase 完了済み。

| サービス | AOSP                                 | GMS                                          | HMS                                         |
| -------- | ------------------------------------ | -------------------------------------------- | ------------------------------------------- |
| Auth     | react-native-app-auth + PKCE         | @react-native-google-signin v16              | Huawei OAuth2 + PKCE                        |
| Calendar | CalendarContract Turbo Module        | CalendarContract Turbo Module (AOSP と同一)  | CalendarContract Turbo Module (AOSP と同一) |
| Backup   | AsyncStorage ローカル backup/restore | Google Drive appDataFolder                   | Huawei Drive appDataFolder                  |
| Sleep    | 手動入力 (AsyncStorage)              | Health Connect (react-native-health-connect) | 手動入力 (AOSP と同一)                      |

### 各実装の詳細

**GMS Auth**: `@react-native-google-signin/google-signin` v16 でネイティブ認証。`react-native-config` から Web Client ID を読み込み。スコープは `drive.appdata` のみ（バックアップ用）。

**AOSP Auth**: `react-native-app-auth` で Chrome Custom Tabs + PKCE による Google OAuth2。GMS 不要で Google API にアクセス可能。トークンは端末のセキュアストレージに保存し、自動リフレッシュにも対応する。`tokenUtils.ts` で JWT id_token からメールを抽出する。スコープは `drive.appdata` のみ。

**Calendar（全プラットフォーム共通）**: Kotlin Turbo Module (`NativeCalendarModule`) で Android CalendarContract を直接読取。`READ_CALENDAR` パーミッションのみで動作し、OAuth 認証不要。すべてのプラットフォームで同一の `createAospCalendarService()` を使用する。

**GMS Backup**: `googleDriveApi.ts` で Google Drive appDataFolder にバックアップファイルをアップロード/ダウンロード。ファイルの検索・作成・更新・取得に対応。

**AOSP Backup**: AsyncStorage ベースのローカル backup/restore。クラウド同期なし（ファイルエクスポート/インポートは将来実装予定）。

**HMS Auth と Backup**: `react-native-app-auth` を使って Huawei OAuth2 に接続し、Huawei Drive appDataFolder にバックアップを保存する。カレンダーは CalendarContract、睡眠は手動入力を AOSP 実装と共有する。

**GMS Sleep**: `react-native-health-connect` で Health Connect API から睡眠セッションを取得。睡眠ステージ (unknown/awake/sleeping/out_of_bed/light/deep/rem) をマッピング。

**AOSP Sleep**: AsyncStorage ベースの手動睡眠入力 CRUD。Health Connect は GMS 依存のため AOSP ではフォールバック。

## プラットフォーム検出フロー

```txt
detectPlatform()
  │
  ├─ GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false })
  │   ├─ true  → "gms"
  │   └─ false → 端末メーカーを確認
  │       ├─ Huawei → "hms"
  │       └─ それ以外 → "aosp"
  │
  └─ catch → 端末メーカーを確認
```

HMS は端末メーカー名が `huawei` の場合に選択する。

## コンポーネントからの使用方法

バックアップ等のプラットフォーム固有機能は `platformServicesAtom` 経由で使用:

```typescript
import { useAtomValue } from "jotai";
import { platformServicesAtom } from "../atoms/platformAtoms";

function MyComponent() {
  const services = useAtomValue(platformServicesAtom);

  const handleBackup = async () => {
    if (await services.backup.isAvailable()) {
      await services.backup.backup(JSON.stringify(data));
    }
  };
}
```

カレンダーは `READ_CALENDAR` パーミッションのみで動作し、認証不要:

```typescript
import { useAtomValue } from "jotai";
import { platformServicesAtom } from "../atoms/platformAtoms";

function MyComponent() {
  const services = useAtomValue(platformServicesAtom);

  const handleSync = async () => {
    if (await services.calendar.isAvailable()) {
      const events = await services.calendar.fetchEvents(startMs, endMs);
    }
  };
}
```

## テスト

テストファイルは `__tests__/core/platform/` および `__tests__/core/drive/` に配置。

| ファイル                       | テスト数 | 内容                                        |
| ------------------------------ | -------- | ------------------------------------------- |
| `detection.test.ts`            | 2        | GMS available / unavailable                 |
| `factory.test.ts`              | 4        | aosp/gms/hms 各タイプ + 実装差異            |
| `aospServices.test.ts`         | 25       | auth + calendar + backup + sleep 統合テスト |
| `gmsServices.test.ts`          | 14       | auth + backup + sleep 統合テスト            |
| `aosp/authService.test.ts`     | 12       | AppAuth 認証フロー、トークン管理            |
| `aosp/backupService.test.ts`   | 6        | AsyncStorage backup/restore                 |
| `aosp/calendarService.test.ts` | 8        | CalendarContract Turbo Module 経由の読取    |
| `aosp/tokenUtils.test.ts`      | 6        | JWT デコード、メール抽出                    |
| `gms/authService.test.ts`      | 7        | GoogleSignin wrapper                        |
| `gms/backupService.test.ts`    | 13       | Google Drive appDataFolder API              |
| `drive/googleDriveApi.test.ts` | -        | Google Drive API クライアント               |

テスト実行:

```bash
pnpm jest __tests__/core/platform/
```

## 今後の実装計画

| 項目                 | 内容                                                          |
| -------------------- | ------------------------------------------------------------- |
| AOSP ファイル Export | AsyncStorage ローカルバックアップをファイルエクスポートに拡張 |

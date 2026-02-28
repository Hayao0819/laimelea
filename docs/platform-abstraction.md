# プラットフォーム抽象化レイヤー

GMS/HMS/AOSP を統一インターフェースで切り替える基盤。アラーム・通知は AOSP API のみで動作し GMS 不要。GMS 依存は**認証・カレンダー同期・バックアップ・睡眠データ**の 4 機能のみで、これらをインターフェースで抽象化している。

## アーキテクチャ概要

```txt
Providers.tsx (mount)
  └─ detectPlatform()           ← GMS 有無を判定
       └─ platformTypeAtom      ← "gms" | "hms" | "aosp"
            └─ platformServicesAtom (derived)
                 └─ createPlatformServices(type)
                      ├─ aosp/ ─ authService, calendarService, backupService, sleepService
                      ├─ gms/  ─ authService, calendarService, backupService, sleepService
                      └─ hms/  ─ (AOSP を再利用、将来実装)
```

## ディレクトリ構成

```txt
src/core/platform/
├── types.ts              # 全インターフェース定義 (PlatformServices, Auth, Calendar, Backup, Sleep)
├── detection.ts          # detectPlatform() — GoogleSignin.hasPlayServices() で GMS 検出
├── factory.ts            # createPlatformServices() — type に応じたサービス生成
├── index.ts              # barrel export
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
│   ├── authConfig.ts     # GMS 用 OAuth2 設定 (calendar.readonly, drive.appdata スコープ)
│   ├── calendarService.ts # Google Calendar REST API 経由のイベント取得
│   ├── backupService.ts  # Google Drive appDataFolder API (googleDriveApi 経由)
│   ├── sleepService.ts   # Health Connect API (react-native-health-connect)
│   └── index.ts
├── hms/                  # 空 (将来の Huawei Mobile Services 対応用)
└── native/
    ├── NativeCalendarModule.ts  # Turbo Module spec (CalendarContract バインディング)
    └── calendarModule.ts        # Native module ブリッジ

src/core/drive/
├── googleDriveApi.ts            # Google Drive appDataFolder API クライアント
└── __tests__/
    └── googleDriveApi.test.ts   # Drive API テスト

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

| サービス | AOSP                                 | GMS                                          | HMS           |
| -------- | ------------------------------------ | -------------------------------------------- | ------------- |
| Auth     | react-native-app-auth + PKCE         | @react-native-google-signin v16              | 未実装 (将来) |
| Calendar | CalendarContract Turbo Module        | Google Calendar REST API                     | 未実装 (将来) |
| Backup   | AsyncStorage ローカル backup/restore | Google Drive appDataFolder                   | 未実装 (将来) |
| Sleep    | 手動入力 CRUD (AsyncStorage)         | Health Connect (react-native-health-connect) | 未実装 (将来) |

### 各実装の詳細

**GMS Auth**: `@react-native-google-signin/google-signin` v16 でネイティブ認証。`react-native-config` から Web Client ID を読み込み。スコープは `calendar.readonly` + `drive.appdata`。

**AOSP Auth**: `react-native-app-auth` で Chrome Custom Tabs + PKCE による Google OAuth2。GMS 不要で Google API にアクセス可能。トークンは AsyncStorage に永続化し、自動リフレッシュ対応。`tokenUtils.ts` で JWT id_token からメール抽出。

**GMS Calendar**: `googleCalendarApi.ts` 経由で Google Calendar REST API を呼び出し。マルチカレンダー対応、イベントを `CalendarEvent` 型に正規化。

**AOSP Calendar**: Kotlin Turbo Module (`NativeCalendarModule`) で Android CalendarContract を直接読取。`react-native-calendar-events` は New Architecture 非対応のため自前実装。

**GMS Backup**: `googleDriveApi.ts` で Google Drive appDataFolder にバックアップファイルをアップロード/ダウンロード。ファイルの検索・作成・更新・取得に対応。

**AOSP Backup**: AsyncStorage ベースのローカル backup/restore。クラウド同期なし（ファイルエクスポート/インポートは将来実装予定）。

**GMS Sleep**: `react-native-health-connect` で Health Connect API から睡眠セッションを取得。睡眠ステージ (unknown/awake/sleeping/out_of_bed/light/deep/rem) をマッピング。

**AOSP Sleep**: AsyncStorage ベースの手動睡眠入力 CRUD。Health Connect は GMS 依存のため AOSP ではフォールバック。

## プラットフォーム検出フロー

```txt
detectPlatform()
  │
  ├─ GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false })
  │   ├─ true  → "gms"
  │   └─ false → "aosp"
  │
  └─ catch → "aosp"
```

HMS 検出は将来フェーズで `HmsAvailability.isHuaweiMobileServicesAvailable()` を追加予定。

## コンポーネントからの使用方法

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

## テスト

テストファイルは `__tests__/core/platform/` および `src/core/drive/__tests__/` に配置。

| ファイル                       | テスト数 | 内容                                                        |
| ------------------------------ | -------- | ----------------------------------------------------------- |
| `detection.test.ts`            | 2        | GMS available / unavailable                                 |
| `factory.test.ts`              | 4        | aosp/gms/hms 各タイプ + 実装差異                            |
| `aospServices.test.ts`         | 25       | auth + calendar + backup + sleep 統合テスト                 |
| `gmsServices.test.ts`          | 21       | auth + calendar + backup + sleep 統合テスト                 |
| `aosp/authService.test.ts`     | 12       | AppAuth 認証フロー、トークン管理                            |
| `aosp/backupService.test.ts`   | 6        | AsyncStorage backup/restore                                 |
| `aosp/calendarService.test.ts` | 8        | CalendarContract Turbo Module 経由の読取                    |
| `aosp/tokenUtils.test.ts`      | 6        | JWT デコード、メール抽出                                    |
| `gms/authService.test.ts`      | 7        | GoogleSignin wrapper                                        |
| `gms/backupService.test.ts`    | 13       | Google Drive appDataFolder API                              |
| `gms/calendarService.test.ts`  | 8        | Calendar REST API 呼び出し                                  |
| `drive/googleDriveApi.test.ts` | -        | Drive API クライアント (`src/core/drive/__tests__/` に配置) |

テスト実行:

```bash
pnpm jest __tests__/core/platform/
```

## 今後の実装計画

| 項目                 | 内容                                                          |
| -------------------- | ------------------------------------------------------------- |
| AOSP ファイル Export | AsyncStorage ローカルバックアップをファイルエクスポートに拡張 |
| HMS 実装             | `hms/` ディレクトリに Huawei Mobile Services 対応を追加       |

# プラットフォーム抽象化レイヤー

GMS/HMS/AOSP を統一インターフェースで切り替える基盤。アラーム・通知は AOSP API のみで動作し GMS 不要。GMS 依存は**認証・カレンダー同期・バックアップ・睡眠データ**の 4 機能のみで、これらをインターフェースで抽象化している。

## アーキテクチャ概要

```
Providers.tsx (mount)
  └─ detectPlatform()           ← GMS 有無を判定
       └─ platformTypeAtom      ← "gms" | "hms" | "aosp"
            └─ platformServicesAtom (derived)
                 └─ createPlatformServices(type)
                      ├─ aosp/ ─ authService, calendarService, backupService, sleepService
                      ├─ gms/  ─ authService, calendarService, backupService, sleepService
                      └─ hms/  ─ (AOSP stubs を再利用)
```

## ディレクトリ構成

```
src/core/platform/
├── types.ts              # 全インターフェース定義 (PlatformServices, Auth, Calendar, Backup, Sleep)
├── detection.ts          # detectPlatform() — GoogleSignin.hasPlayServices() で GMS 検出
├── factory.ts            # createPlatformServices() — type に応じたサービス生成
├── index.ts              # barrel export
├── aosp/
│   ├── authService.ts    # stub (isAvailable=false, signIn throws)
│   ├── calendarService.ts # stub (空配列返却)
│   ├── backupService.ts  # AsyncStorage ベース backup/restore
│   ├── sleepService.ts   # stub (空配列返却)
│   └── index.ts
└── gms/
    ├── authService.ts    # GoogleSignin wrapper (signIn/signOut/getTokens)
    ├── calendarService.ts # stub (Phase 11+ で Calendar REST API)
    ├── backupService.ts  # AsyncStorage stub (Phase 11+ で Google Drive)
    ├── sleepService.ts   # stub (Phase 14+ で Health Connect)
    └── index.ts

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

### Phase 10a (完了): 検出 + ファクトリ + スタブ

| サービス | AOSP              | GMS                  | HMS        |
| -------- | ----------------- | -------------------- | ---------- |
| Auth     | stub (不可)       | GoogleSignin wrapper | AOSP stubs |
| Calendar | stub (空)         | stub (空)            | AOSP stubs |
| Backup   | AsyncStorage 実装 | AsyncStorage stub    | AOSP stubs |
| Sleep    | stub (空)         | stub (空)            | AOSP stubs |

- プラットフォーム検出: `GoogleSignin.hasPlayServices()` で GMS/AOSP を自動判定
- ファクトリ: `createPlatformServices()` で exhaustive switch
- Jotai atom: `platformTypeAtom` → derived `platformServicesAtom`
- Providers.tsx: マウント時に `detectPlatform()` → atom 更新
- テスト: 31 cases (detection 3, factory 4, aosp 12, gms 12)

### Phase 10b (未実装): AOSP 認証

- `react-native-app-auth` で Chrome Custom Tabs + PKCE による Google OAuth2
- GMS 不要で Google API にアクセス可能
- Granular Consent 対応（スコープ個別拒否時のフォールバック）

### Phase 10c (未実装): CalendarContract Turbo Module

- `react-native-calendar-events` は 5 年間未更新で New Architecture 非対応
- Kotlin Turbo Module で Android CalendarContract を直接読取
- AOSP/HMS のカレンダーソースとして使用

## プラットフォーム検出フロー

```
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

テストファイルは `__tests__/core/platform/` に配置。

| ファイル               | テスト数 | 内容                                         |
| ---------------------- | -------- | -------------------------------------------- |
| `detection.test.ts`    | 3        | GMS available / false / throws               |
| `factory.test.ts`      | 4        | aosp/gms/hms 各タイプ + 実装差異             |
| `aospServices.test.ts` | 12       | auth(4) + calendar(3) + backup(3) + sleep(2) |
| `gmsServices.test.ts`  | 12       | auth(6) + calendar(3) + backup(1) + sleep(2) |

テスト実行:

```bash
pnpm jest __tests__/core/platform/
```

## 今後の実装計画

Phase 10a で確立した抽象化基盤の上に、以下の順で実機能を実装する:

| Phase | 内容                                   | 変更対象                                                 |
| ----- | -------------------------------------- | -------------------------------------------------------- |
| 10b   | AOSP 認証 (react-native-app-auth)      | `aosp/authService.ts`                                    |
| 10c   | CalendarContract Turbo Module (Kotlin) | `aosp/calendarService.ts` + `android/`                   |
| 11    | Calendar REST API + OAuth フロー       | `gms/calendarService.ts`, `gms/authService.ts` configure |
| 11    | Google Drive バックアップ              | `gms/backupService.ts`                                   |
| 14    | Health Connect 睡眠データ              | `gms/sleepService.ts`                                    |
| 14    | 手動睡眠入力 CRUD                      | `aosp/sleepService.ts`                                   |
| 将来  | HMS 実装                               | `hms/` ディレクトリ                                      |

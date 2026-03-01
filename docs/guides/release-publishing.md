# リリース・公開ガイド

Laimelea を各ストアに公開するための手順と鍵管理のガイド。

## 目次

- [署名鍵の管理](#署名鍵の管理)
- [Google Play](#google-play)
- [F-Droid](#f-droid)
- [その他の配信チャネル](#その他の配信チャネル)
- [リリース前チェックリスト](#リリース前チェックリスト)

## 署名鍵の管理

### Keystore 生成

リリース用の upload keystore を作成する。

```bash
keytool -genkeypair \
  -alias upload \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -keystore release-upload.keystore \
  -storetype PKCS12 \
  -dname "CN=Hayao, OU=Dev, O=Laimelea, L=Tokyo, ST=Tokyo, C=JP"
```

- **アルゴリズム**: RSA（全 Android バージョンで互換性あり）
- **鍵サイズ**: 4096-bit（NIST は 2030 年以降 3072-bit 以上を推奨）
- **有効期間**: 10,000 日（約 27 年）。Google Play は 2033 年 10 月 22 日以降まで有効である必要がある
- **形式**: PKCS12（`.p12`/`.pfx`）。JKS はレガシー

証明書のエクスポート（Play Console 登録用）:

```bash
keytool -export -rfc \
  -keystore release-upload.keystore \
  -alias upload \
  -file upload-certificate.pem
```

### Keystore のセキュリティ

- keystore ファイル、パスワード、`keystore.properties` を**絶対に VCS にコミットしない**
- `.gitignore` に `*.keystore` と `keystore.properties` を追加（本プロジェクトは `*.keystore` が既に追加済み）
- keystore はパスワードマネージャ（1Password、Bitwarden 等）の Vault に保管
- **複数箇所に暗号化バックアップ**を作成（地理的に分散させる）
- keystore ファイルとパスワードは**別々の場所**に保管

### Play App Signing

Google Play では新規アプリに Play App Signing が**必須**。2 つの鍵を使い分ける:

| 項目 | Upload Key | App Signing Key |
|---|---|---|
| 用途 | Play Console へのアップロード認証 | ユーザーへ配信される APK の署名 |
| 管理者 | 開発者 | Google（HSM で保管） |
| 紛失時 | Play Console でリセット可能 | 不可逆（Google が管理するため安全） |

Upload key を紛失した場合のリセット手順:

1. 新しい keystore を生成
2. 証明書を `.pem` でエクスポート
3. Play Console → リリース → 設定 → アプリの署名 → 「アップロード鍵のリセットをリクエスト」
4. `.pem` をアップロード（処理に数日かかる）

### Gradle 署名設定

本プロジェクトの `android/app/build.gradle` は既に環境変数パターンを実装済み:

```groovy
signingConfigs {
    release {
        def ksFile = System.getenv('RELEASE_KEYSTORE_FILE')
        if (ksFile != null && file(ksFile).exists()) {
            storeFile = file(ksFile)
            storePassword = System.getenv('RELEASE_STORE_PASSWORD')
            keyAlias = System.getenv('RELEASE_KEY_ALIAS')
            keyPassword = System.getenv('RELEASE_KEY_PASSWORD')
        } else {
            // debug keystore にフォールバック
        }
    }
}
```

リリースビルド時に環境変数を設定:

```bash
export RELEASE_KEYSTORE_FILE=/path/to/release-upload.keystore
export RELEASE_STORE_PASSWORD='your-store-password'
export RELEASE_KEY_ALIAS='upload'
export RELEASE_KEY_PASSWORD='your-key-password'

cd android && ./gradlew bundleRelease
```

### CI/CD での署名（GitHub Actions）

keystore を base64 エンコードして Secrets に保存:

```yaml
- name: Decode keystore
  run: echo "${{ secrets.RELEASE_KEYSTORE_BASE64 }}" | base64 -d > android/app/release.keystore

- name: Build release AAB
  env:
    RELEASE_KEYSTORE_FILE: ${{ github.workspace }}/android/app/release.keystore
    RELEASE_STORE_PASSWORD: ${{ secrets.RELEASE_STORE_PASSWORD }}
    RELEASE_KEY_ALIAS: ${{ secrets.RELEASE_KEY_ALIAS }}
    RELEASE_KEY_PASSWORD: ${{ secrets.RELEASE_KEY_PASSWORD }}
  run: cd android && ./gradlew bundleRelease
```

## Google Play

### デベロッパーアカウント登録

- **登録料**: $25（一度きり、年会費なし）
- **アカウント種別**:
  - **個人**: 政府発行の身分証明書が必要
  - **組織**: D-U-N-S ナンバー + Web サイトが必要
- **本人確認**: メールアドレス、電話番号（OTP）、公開用の連絡先メール
- **2026 年新要件**: Android Developer Verification が 2026 年 3 月から登録開始、9 月からブラジル等で義務化

### ストア掲載情報

| 項目 | 制限 |
|---|---|
| アプリ名 | 30 文字以内 |
| 短い説明 | 80 文字以内 |
| 詳細な説明 | 4,000 文字以内 |

### ビジュアルアセット

| アセット | 仕様 |
|---|---|
| アプリアイコン | 512x512 px, 32-bit PNG (alpha 可), 1024 KB 以下 |
| フィーチャーグラフィック | 1024x500 px, JPEG or 24-bit PNG (alpha 不可) |
| スクリーンショット（スマホ） | 最小 2 枚, 最大 8 枚。推奨: 1080x1920 px |
| スクリーンショット（タブレット） | 7 インチ / 10 インチ各最大 8 枚 |

### 必須申告事項

1. **プライバシーポリシー**: 公開 URL で提供（PDF 不可、編集不可）。アプリ内からもリンク必須
2. **コンテンツのレーティング (IARC)**: Play Console でアンケートに回答。無料、即時発行
3. **データセーフティ**: 収集・共有するデータの種類と目的を申告。Laimelea の場合:
   - アラームデータ、睡眠ログ、カレンダーデータの保存
   - Google Drive バックアップ時の OAuth2 認証情報
   - Google Calendar API 経由のカレンダーデータ
4. **対象年齢**: 時計アプリなら 13+ または全年齢
5. **財務機能の申告**: 2025 年 10 月 30 日から全アプリ必須

### リリーストラック

段階的にリリースする:

1. **内部テスト**: 最大 100 人。即座に利用可能（レビューなし）
2. **クローズドテスト**: 招待制。**新規個人アカウント（2023 年 11 月以降作成）は 12 人以上のテスターで 14 日間の実施が必須**
3. **オープンテスト**（任意）: 公開ベータ。Play ストアから誰でも参加可能
4. **本番**: 段階的ロールアウト推奨（10% → 50% → 100%）

### AAB 要件

- 2021 年 8 月以降、新規アプリは **Android App Bundle (AAB)** 必須（APK 不可）
- ビルドコマンド: `cd android && ./gradlew bundleRelease`
- 出力: `android/app/build/outputs/bundle/release/app-release.aab`

### ターゲット API レベル（2025 年）

- 新規アプリ・アップデート: **API 35 (Android 15)** 以上（2025 年 8 月 31 日から）
- 既存アプリ: API 34 以上（さもなくば新規ユーザーへの表示が制限される）

### バージョン管理

- **versionCode** (整数): アップロードごとに厳密に増加。最大値: 2,100,000,000
- **versionName** (文字列): ユーザー表示用。Semantic Versioning 推奨 (e.g., `1.0.0`)
- `package.json` の `version` と `build.gradle` の `versionName` を常に同期させること

### 審査

- 所要時間: 数時間〜3 日（新規アカウントは最大 7 日）
- よくあるリジェクト理由: プライバシーポリシー不備、不正確なデータセーフティ、不要な権限要求、技術的問題（クラッシュ、ANR）

## F-Droid

### 掲載基準

F-Droid は **FLOSS (Free, Libre, and Open Source Software)** のみ受け入れる。

**必須条件**:

- DFSG / FSF / OSI 認定のライセンス（GPL, Apache-2.0, MIT 等）
- 公開 VCS にソースコードがあること
- ソースからビルド可能であること
- git タグでリリースを管理すること

**禁止事項**:

- Google Play Services、Firebase、Crashlytics 等のプロプライエタリ追跡/分析ライブラリ
- プロプライエタリ広告 SDK
- サードパーティ API キーのハードコーディング

**例外**: Node.js (npm) 依存は現在許容されている（Debian に代替がないため）。React Native はこの例外に該当する。

### Laimelea の F-Droid 対応

GMS 依存機能（Google Calendar API、Google Drive バックアップ、Health Connect）は F-Droid で問題になる。対策:

- **`fdroid` product flavor を作成**: GMS 依存を除外し、AOSP 実装のみ使用
- または **Anti-Feature ラベルを受け入れる**: `NonFreeDep` / `NonFreeNet`

### 申請手順

1. **リポジトリを準備**: FOSS ライセンスファイル配置、リリースにタグ付け (`v1.0.0`)、fastlane メタデータ追加
2. **fdroiddata をフォーク**: [gitlab.com/fdroid/fdroiddata](https://gitlab.com/fdroid/fdroiddata) をフォーク
3. **メタデータファイル作成**: `metadata/<package_id>.yml` を追加
4. **ローカルテスト**: `fdroid lint`, `fdroid build` で検証
5. **Merge Request を提出**: コミットメッセージ `New App: com.hayao0819.laimelea`
6. **レビュー後に公開**: マージ後 24-48 時間で公開

### React Native 用ビルドレシピ例

```yaml
Categories:
  - Time

License: GPL-3.0-or-later

AuthorName: Hayao
Name: Laimelea
Summary: Custom day cycle clock app

RepoType: git
Repo: https://github.com/hayao0819/laimelea.git

Builds:
  - versionName: '1.0.0'
    versionCode: 1
    commit: v1.0.0
    subdir: android/app
    sudo:
      - apt-get update
      - apt-get install -y npm nodejs
      - npm install -g corepack
      - corepack enable
      - corepack prepare pnpm@9 --activate
    init:
      - cd ../..
      - pnpm install --frozen-lockfile
    gradle:
      - fdroid
    scanignore:
      - node_modules/hermes-engine/
      - node_modules/react-native/android/
      - node_modules/jsc-android/
      - node_modules/@notifee/react-native/android/
      - node_modules/react-native-reanimated/android/

AutoUpdateMode: Version %v
UpdateCheckMode: Tags
CurrentVersion: '1.0.0'
CurrentVersionCode: 1
```

### React Native 固有の注意点

- **ビルドサーバー環境**: Debian Trixie（2026 年初頭〜）。Node.js 18 が apt で利用可能
- **scanignore**: `node_modules` 内のプリビルトバイナリ (`.jar`, `.aar`, `.so`) を許可リストに追加
- **Hermes**: MIT ライセンスで F-Droid 互換。`scanignore` に追加が必要
- **再現可能ビルド**: React Native では非常に困難（Hermes バイトコード、Metro バンドラー）。F-Droid 署名を受け入れるのが現実的

### 署名

デフォルトでは F-Droid がビルドサーバーで独自に署名する。Play Store 版と F-Droid 版は**署名が異なるため相互移行不可**。

### 更新

```yaml
AutoUpdateMode: Version %v
UpdateCheckMode: Tags
```

この設定で git タグを検出し自動的に新バージョンをビルドする。タグ push から公開まで通常 1-3 日。

### Fastlane メタデータ

リポジトリに `fastlane/metadata/android/` を配置:

```text
fastlane/metadata/android/
  en-US/
    title.txt
    short_description.txt
    full_description.txt
    changelogs/
      1.txt
    images/
      icon.png
      featureGraphic.png
      phoneScreenshots/
        01_clock.png
        02_alarms.png
  ja/
    title.txt
    short_description.txt
    full_description.txt
```

このメタデータは Google Play の Triple-T Gradle プラグインとも共有できる。

## その他の配信チャネル

### GitHub Releases（推奨）

- **コスト**: 無料
- **方法**: リリースタグに署名済み APK を添付
- **自動更新**: [Obtainium](https://github.com/ImranR98/Obtainium) が GitHub Releases を自動追跡。ユーザーはリポジトリ URL を追加するだけ
- **メリット**: オープンソースプロジェクトに最適、CI/CD で自動化可能
- **注意**: 2026 年 9 月から一部地域でサイドロードにも Android Developer Verification が必要（$25、ホビイスト/学生は免除の可能性）

### Amazon Appstore

- **登録料**: 無料
- **メリット**: Fire OS は AOSP フォーク（GMS なし）→ Laimelea の AOSP パスがそのまま動作
- **収益分配**: 80/20（年間$1M 以下の開発者）

### Huawei AppGallery

- **登録料**: 無料（本人確認に政府発行 ID + 銀行カードスキャンが必要）
- **メリット**: GMS なしの Huawei デバイスが Laimelea のターゲットユーザー層に合致
- **HMS**: HMS Core 統合は必須ではない。標準 APK で提出可能

### Samsung Galaxy Store

- **登録料**: 無料
- **収益分配**: 80/20（2025 年 5 月〜）
- **メリット**: 全 Samsung デバイスにプリインストール済み

## リリース前チェックリスト

### 共通

- [ ] バージョン統一: `package.json`, `build.gradle` の versionName/versionCode を同期
- [ ] リリース keystore を生成し安全に保管
- [ ] ProGuard/R8 を有効化（リリースビルドのサイズ最適化）
- [ ] リリース APK/AAB の動作確認
- [ ] プライバシーポリシーを公開 URL で用意
- [ ] CHANGELOG を整備
- [ ] fastlane メタデータを作成（説明文、スクリーンショット、アイコン）
- [ ] リリースタグの命名規則を統一（`v1.0.0` 形式）

### Google Play 固有

- [ ] デベロッパーアカウント登録（$25）
- [ ] Play App Signing に登録
- [ ] AAB ビルド確認 (`./gradlew bundleRelease`)
- [ ] ストア掲載情報（タイトル、説明、フィーチャーグラフィック）
- [ ] IARC コンテンツレーティング回答
- [ ] データセーフティ申告
- [ ] 対象年齢・財務機能申告
- [ ] クローズドテスト（12 人以上、14 日間）
- [ ] プレリリースレポート確認

### F-Droid 固有

- [ ] FOSS ライセンスファイルの配置
- [ ] `fdroid` product flavor の作成（GMS 依存除外）
- [ ] fdroiddata メタデータ `.yml` の作成
- [ ] ローカルでのビルドテスト
- [ ] scanignore の設定確認

### GitHub Releases 固有

- [ ] CI/CD で APK 自動ビルド・署名
- [ ] リリースノート作成
- [ ] APK をリリースに添付

## 参考リンク

- [Sign your app - Android Developers](https://developer.android.com/studio/publish/app-signing)
- [Play App Signing - Play Console Help](https://support.google.com/googleplay/android-developer/answer/9842756)
- [Google Play Console](https://play.google.com/console/)
- [F-Droid Inclusion Policy](https://f-droid.org/docs/Inclusion_Policy/)
- [F-Droid Build Metadata Reference](https://f-droid.org/docs/Build_Metadata_Reference/)
- [Adding React Native Apps to F-Droid](https://f-droid.org/2020/10/14/adding-react-native-app-to-f-droid.html)
- [Obtainium](https://github.com/ImranR98/Obtainium)

# GCPプロジェクトセットアップガイド

LaimeleaのGoogle Drive バックアップ連携（OAuth2認証）を動作させるために必要なGCPプロジェクトのセットアップ手順。

Terraform で自動化できる部分（プロジェクト作成、API有効化）と、手動で行う部分（OAuth同意画面、Client ID作成）に分かれる。

## 前提条件

- `nix develop` 環境に入っていること（Terraform, gcloud CLI が含まれる）
- Google アカウントを持っていること
- 請求先アカウント（Billing Account）が有効であること

```bash
# nix develop 環境に入る
nix develop

# 含まれるツールの確認
terraform version
gcloud version
```

## 全体の流れ

1. gcloud 認証
2. Billing Account ID の確認
3. Terraform で GCP プロジェクト作成 + API 有効化
4. OAuth 同意画面を手動設定
5. OAuth Client ID を手動作成（Web + Android）
6. .env に Client ID を記入
7. アプリをビルドして認証テスト

---

## Step 1: gcloud 認証

Terraform が GCP を操作するために、gcloud で認証する。2つの認証が必要。

```bash
# ブラウザが開き、Google アカウントでログインする
gcloud auth login

# Application Default Credentials（Terraform が使用する）
gcloud auth application-default login
```

認証が成功したか確認:

```bash
gcloud auth list
# → 認証済みアカウントが表示される

gcloud config get-value account
# → メールアドレスが表示される
```

## Step 2: Billing Account ID の確認

API を有効化するには GCP プロジェクトに Billing Account が紐付いている必要がある。

```bash
gcloud billing accounts list
```

出力例:

```txt
ACCOUNT_ID            NAME                OPEN  MASTER_ACCOUNT_ID
0X0X0X-0X0X0X-0X0X0X  My Billing Account  True
```

`ACCOUNT_ID` の値（`0X0X0X-0X0X0X-0X0X0X` 形式）を控えておく。

## Step 3: Terraform でプロジェクト作成

### 3-1. 変数ファイルを作成

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```

`terraform.tfvars` を編集:

```hcl
project_id      = "laimelea-YOUR-UNIQUE-ID"    # グローバルにユニーク（例: laimelea-dev-12345）
billing_account = "0X0X0X-0X0X0X-0X0X0X"       # Step 2 で確認した値
support_email   = "your-email@gmail.com"        # OAuth 同意画面のサポートメール
```

> **project_id の命名規則**: 6〜30文字、小文字・数字・ハイフンのみ、先頭は英字、末尾はハイフン不可。既に使用中のIDは不可。

オプション:

```hcl
# Google Workspace / Cloud Identity 組織アカウントの場合のみ
org_id = "123456789"

# デフォルトは asia-northeast1（東京）
region = "asia-northeast1"
```

### 3-2. Terraform 初期化

```bash
terraform init
```

出力例:

```txt
Initializing the backend...
Initializing provider plugins...
- Finding hashicorp/google versions matching "~> 6.0"...
- Finding hashicorp/google-beta versions matching "~> 6.0"...
- Installing hashicorp/google v6.x.x...
- Installing hashicorp/google-beta v6.x.x...

Terraform has been successfully initialized!
```

> `nix develop` 環境では `terraform.withPlugins` でプロバイダーがバンドルされているため、ネットワークからのダウンロードは不要。

### 3-3. 実行計画を確認

```bash
terraform plan
```

作成されるリソースを確認:

```txt
Plan: 7 to add, 0 to change, 0 to destroy.

  + google_project.laimelea
  + google_project_service.calendar_api
  + google_project_service.people_api
  + google_project_service.iam_credentials_api
  + google_project_service.resource_manager_api
  + google_project_service.drive_api
  + google_storage_bucket.tfstate
```

### 3-4. リソースを作成

```bash
terraform apply
```

確認プロンプトで `yes` を入力。完了まで数分かかる。

成功すると以下が出力される:

```txt
Apply complete! Resources: 7 added, 0 changed, 0 destroyed.

Outputs:

manual_setup_instructions = <<EOT
  以下の手順でOAuth Client IDを手動作成してください:
  ...
EOT

project_id = "laimelea-YOUR-UNIQUE-ID"
project_number = "1234567890"
```

### 3-5. (オプション) Terraform ステートをリモートに移行

チームで管理する場合や、ローカルのステートファイルを紛失するリスクを避けたい場合、GCS バケットにステートを移行できる。

`infra/main.tf` のバックエンド設定をアンコメント:

```hcl
backend "gcs" {
  bucket = "laimelea-YOUR-UNIQUE-ID-tfstate"  # project_id に -tfstate を付けたもの
  prefix = "terraform/state"
}
```

ステートを移行:

```bash
terraform init -migrate-state
# → "yes" と入力

# 移行後、ローカルステートを削除
rm terraform.tfstate terraform.tfstate.backup
```

## Step 4: OAuth 同意画面を設定

Terraform では管理できないため、Google Cloud Console で手動設定する。

```bash
# プロジェクトIDを確認
terraform output project_id
```

### 4-1. 同意画面にアクセス

ブラウザで以下を開く（`PROJECT_ID` は実際の値に置換）:

<https://console.cloud.google.com/apis/credentials/consent?project=PROJECT_ID>

または:

```bash
# gcloud でブラウザを開く
gcloud services list --project="$(terraform output -raw project_id)"
# → Console のリンクが表示されるので、そこから Credentials → OAuth consent screen へ移動
```

### 4-2. 同意画面の設定値

| 項目                       | 値                                           |
| -------------------------- | -------------------------------------------- |
| User Type                  | 外部（External）                             |
| アプリ名                   | `Laimelea`                                   |
| ユーザー サポートメール    | `terraform.tfvars` の `support_email` と同じ |
| デベロッパーの連絡先メール | 同上                                         |

### 4-3. スコープの追加

「スコープを追加または削除」をクリックし、以下を追加:

| スコープ                                        | 説明                                        |
| ----------------------------------------------- | ------------------------------------------- |
| `openid`                                        | OpenID Connect（自動選択される場合あり）    |
| `email`                                         | メールアドレス                              |
| `profile`                                       | 基本プロフィール                            |
| `https://www.googleapis.com/auth/drive.appdata` | Google Drive アプリデータ（バックアップ用） |

### 4-4. テストユーザーの追加

公開ステータスが「テスト」のままの場合、自分のGoogleアカウントをテストユーザーとして追加する必要がある。

「テストユーザー」→「ユーザーを追加」→ 自分のメールアドレスを入力。

> **本番公開時**: Google の審査を通す必要がある。テスト段階ではテストユーザー追加で十分。

## Step 5: OAuth Client ID を作成

### 5-1. 認証情報ページにアクセス

<https://console.cloud.google.com/apis/credentials?project=PROJECT_ID>

### 5-2. Web Client ID を作成

GMS 端末での `@react-native-google-signin` に使用する。

「認証情報を作成」→「OAuth クライアント ID」を選択。

| 項目                   | 値                      |
| ---------------------- | ----------------------- |
| アプリケーションの種類 | ウェブ アプリケーション |
| 名前                   | `Laimelea Web Client`   |

承認済みリダイレクト URI は追加不要。

作成後に表示されるクライアント IDをメモ → `.env` の `GOOGLE_WEB_CLIENT_ID` に設定。

### 5-2b. iOS Client ID を作成

AOSP 端末での `react-native-app-auth`（PKCE + Chrome Custom Tabs）によるバックアップ用認証に使用する（Android 上でも必要）。

> **Web クライアントではカスタム URI スキームリダイレクトが許可されない**。`react-native-app-auth` は `com.googleusercontent.apps.{GUID}:/oauth2redirect/google` 形式のカスタムスキームを使うため、このスキームをサポートする **iOS クライアント**が必要。

「認証情報を作成」→「OAuth クライアント ID」を選択。

| 項目                   | 値                       |
| ---------------------- | ------------------------ |
| アプリケーションの種類 | iOS                      |
| 名前                   | `Laimelea OAuth Client`  |
| バンドル ID            | `com.hayao0819.laimelea` |

作成後に表示されるクライアント IDをメモ → `.env` の `GOOGLE_OAUTH_CLIENT_ID` に設定。

### 5-3. Android Client ID を作成

GMS 端末（Google Play Services 搭載端末）で `@react-native-google-signin` を使う場合に必要。

「認証情報を作成」→「OAuth クライアント ID」を選択。

| 項目                           | 値                        |
| ------------------------------ | ------------------------- |
| アプリケーションの種類         | Android                   |
| 名前                           | `Laimelea Android Client` |
| パッケージ名                   | `com.hayao0819.laimelea`  |
| SHA-1 証明書フィンガープリント | 下記の手順で取得          |

#### SHA-1 フィンガープリントの取得

**デバッグ用キーストア**（開発時）:

```bash
# プロジェクトルートで実行
keytool -list -v \
  -keystore android/app/debug.keystore \
  -alias androiddebugkey \
  -storepass android 2>/dev/null | grep SHA1
```

出力例:

```txt
SHA1: AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD
```

このコロン区切りの値をそのまま入力する。

**リリース用キーストア**（本番時）:

```bash
keytool -list -v \
  -keystore /path/to/release.keystore \
  -alias your-key-alias
# → パスワードを入力
```

> **デバッグ用とリリース用は SHA-1 が異なるため、それぞれの Client ID を作成する必要がある**。開発中はデバッグ用のみでよい。

### 5-4. Client ID の使い分け

| Client ID                | 用途                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| `GOOGLE_OAUTH_CLIENT_ID` | AOSP 端末でのバックアップ認証（`react-native-app-auth` + PKCE）      |
| `GOOGLE_WEB_CLIENT_ID`   | GMS 端末でのバックアップ認証（`@react-native-google-signin`）        |
| Android Client ID        | GMS 端末で `@react-native-google-signin` の ID トークン検証に必要    |

カレンダー読取は Android CalendarProvider（`READ_CALENDAR` パーミッション）を使用するため、OAuth 認証は不要。

## Step 6: .env に Client ID を記入

プロジェクトルートに `.env` ファイルを作成:

```bash
cd ..  # infra/ から戻る
cp .env.example .env
```

`.env` を編集:

```env
GOOGLE_OAUTH_CLIENT_ID=111111111-yyyyyyyyy.apps.googleusercontent.com
GOOGLE_WEB_CLIENT_ID=123456789-xxxxxxxxx.apps.googleusercontent.com
```

| 変数名                   | 使用先                               | 値のソース                |
| ------------------------ | ------------------------------------ | ------------------------- |
| `GOOGLE_OAUTH_CLIENT_ID` | `react-native-app-auth`（PKCE）      | iOS Client ID (Step 5-2b) |
| `GOOGLE_WEB_CLIENT_ID`   | `@react-native-google-signin`（GMS） | Web Client ID (Step 5-2)  |

> **2つの Client ID は異なる値にする必要がある**。`GOOGLE_OAUTH_CLIENT_ID` にはカスタム URI スキームリダイレクトをサポートする iOS Client ID を設定すること。

## Step 7: ビルドと認証テスト

### 7-1. Android ビルド

```bash
# クリーンビルド（react-native-config のネイティブ変更を反映するため）
rm -rf android/app/build android/build android/.gradle

# ビルド
cd android && ./gradlew assembleDebug && cd ..
```

### 7-2. エミュレータで起動

```bash
# エミュレータを起動（AVD が作成済みの場合）
emulator -avd Pixel_API_36

# Metro bundler を起動
pnpm start

# 別ターミナルで
pnpm react-native run-android
```

### 7-3. 認証フローをテスト

認証は Google Drive バックアップ用。カレンダーは `READ_CALENDAR` パーミッションのみで動作する。

1. **カレンダー**: アプリ起動後、カレンダータブで端末のカレンダーアプリに登録された予定が表示されることを確認（サインイン不要）
2. **バックアップ**: Settings → バックアップ → サインインをタップ
3. GMS 端末: ネイティブ Google サインインダイアログが表示される。AOSP 端末: Chrome Custom Tabs で Google ログイン画面が開く
4. テストユーザーとしてログイン、Drive アプリデータへのアクセスを承認
5. バックアップの作成・復元が動作することを確認

## トラブルシューティング

### `terraform apply` で権限エラー

```txt
Error: googleapi: Error 403: The caller does not have permission
```

→ `gcloud auth application-default login` を再実行する。

### `terraform apply` で Billing Account エラー

```txt
Error: Error setting billing account: ... PERMISSION_DENIED
```

→ `gcloud billing accounts list` で正しい Account ID を確認。Billing Account のオーナーまたは Billing Account User ロールが必要。

### OAuth ログインで `redirect_uri_mismatch`

```txt
Error 400: redirect_uri_mismatch
```

→ `GOOGLE_OAUTH_CLIENT_ID` に正しい iOS Client ID が設定されているか確認する。`build.gradle` の `appAuthRedirectScheme` はこの Client ID の GUID から自動生成される:

```groovy
// android/app/build.gradle — 自動設定、手動変更不要
def oauthClientGuid = oauthClientId.replace(".apps.googleusercontent.com", "")
manifestPlaceholders = [appAuthRedirectScheme: "com.googleusercontent.apps." + oauthClientGuid]
```

### OAuth ログインで「カスタムスキームは許可されない」

→ `GOOGLE_OAUTH_CLIENT_ID` に **Web Client ID** を設定している可能性がある。Web クライアントはカスタム URI スキームリダイレクトをサポートしない。Step 5-2b で作成した **iOS Client ID** を使用すること。

### OAuth ログインで `access_denied`

→ OAuth 同意画面でテストユーザーとして追加されているか確認。公開ステータスが「テスト」の場合、テストユーザーのみがログインできる。

### `Config.GOOGLE_OAUTH_CLIENT_ID` が空文字になる

→ `.env` ファイルがプロジェクトルートに存在するか確認。また、`.env` を変更した後はクリーンビルドが必要:

```bash
rm -rf android/app/build android/build android/.gradle
cd android && ./gradlew assembleDebug && cd ..
```

### `terraform plan` で provider エラー

```txt
Error: Failed to query available provider packages
```

→ `nix develop` 環境外で実行していないか確認。`nix develop` 内では `terraform.withPlugins` でプロバイダーがバンドルされている。

## ファイル構成の全体像

```txt
laimelea/
├── .env                          # ← Step 6 で作成（.gitignore 対象）
├── .env.example                  # テンプレート（リポジトリに含まれる）
├── infra/
│   ├── main.tf                   # プロバイダー設定
│   ├── project.tf                # GCP プロジェクト + GCS バケット
│   ├── apis.tf                   # API 有効化
│   ├── variables.tf              # 変数定義
│   ├── outputs.tf                # 出力値 + OAuth 手動設定ガイド
│   ├── terraform.tfvars          # ← Step 3-1 で作成（.gitignore 対象）
│   ├── terraform.tfvars.example  # テンプレート
│   └── README.md                 # infra 固有の説明
└── src/core/platform/
    ├── aosp/authConfig.ts        # Config.GOOGLE_OAUTH_CLIENT_ID を参照
    └── gms/authConfig.ts         # Config.GOOGLE_WEB_CLIENT_ID を参照
```

## Terraform 管理リソース一覧

| リソース             | Terraform名                                   | 説明                       |
| -------------------- | --------------------------------------------- | -------------------------- |
| GCP プロジェクト     | `google_project.laimelea`                     | プロジェクト本体           |
| Calendar API         | `google_project_service.calendar_api`         | Google Calendar API        |
| People API           | `google_project_service.people_api`           | ユーザー情報取得           |
| IAM Credentials API  | `google_project_service.iam_credentials_api`  | サービスアカウントトークン |
| Resource Manager API | `google_project_service.resource_manager_api` | リソース管理               |
| Drive API            | `google_project_service.drive_api`            | Google Drive アプリデータ  |
| GCS バケット         | `google_storage_bucket.tfstate`               | Terraform ステート保存     |

## 参考リンク

- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 for Mobile & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [react-native-app-auth ドキュメント](https://github.com/FormidableLabs/react-native-app-auth)
- [@react-native-google-signin ドキュメント](https://react-native-google-signin.github.io/docs/setting-up/get-config-file)
- [react-native-config ドキュメント](https://github.com/luggit/react-native-config)
- [Terraform Google Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)

> **Note**: 2025年10月に Terraform Google Provider v7.0 が GA になった。本プロジェクトは `~> 6.0` を使用中。アップグレードする場合は [v7 Upgrade Guide](https://registry.terraform.io/providers/hashicorp/google/latest/docs/guides/version_7_upgrade) を参照。

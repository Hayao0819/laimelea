# Laimelea GCPインフラストラクチャ

## 概要

このディレクトリはLaimeleaアプリのGoogle Cloud Platform (GCP) インフラをTerraformで管理します。

### Terraform管理範囲

| 項目                         | 管理方法  | Terraformリソース           |
| ---------------------------- | --------- | --------------------------- |
| GCPプロジェクト作成          | Terraform | `google_project`            |
| API有効化                    | Terraform | `google_project_service`    |
| Terraformステートバケット    | Terraform | `google_storage_bucket`     |
| OAuth同意画面                | 手動      | なし（Terraform API非対応） |
| OAuth Client ID（Web）       | 手動      | なし（Terraform API非対応） |
| OAuth Client ID（Android）   | 手動      | なし（Terraform API非対応） |

## 前提条件

1. **gcloud CLI** がインストールされていること（`nix develop` 環境に含まれる）
2. **gcloud認証** が完了していること:

   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

3. **Billing Account** が有効であること（APIを有効化するにはbillingが必要）
4. **Terraform** がインストールされていること（`nix develop` 環境に含まれる）

## 初期セットアップ手順

### 1. 変数ファイルを作成

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```

`terraform.tfvars` を編集し、実際の値を設定:

```hcl
project_id      = "laimelea-dev"         # グローバルにユニークなプロジェクトID
billing_account = "XXXXXX-XXXXXX-XXXXXX" # gcloud billing accounts list で確認
support_email   = "your-email@example.com"
# org_id        = "123456789"            # 組織アカウントの場合のみ
```

### 2. Terraform初期化

```bash
terraform init
```

### 3. 実行計画を確認

```bash
terraform plan
```

### 4. リソースを作成

```bash
terraform apply
```

## OAuth手動設定手順

Terraform applyが完了したら、以下の手動設定を行います。`terraform output manual_setup_instructions` で手順を確認できます。

### 1. OAuth同意画面を設定

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials/consent) を開く
2. User Type: 「外部」を選択
3. アプリ名: `Laimelea`
4. サポートメール: `terraform.tfvars` の `support_email` と同じ値
5. スコープ: `calendar.readonly`, `calendar.events.readonly`, `userinfo.email`, `userinfo.profile`

### 2. Web Client IDを作成

1. [認証情報ページ](https://console.cloud.google.com/apis/credentials) を開く
2. 「認証情報を作成」→「OAuth クライアントID」
3. アプリケーションの種類: 「ウェブ アプリケーション」
4. 名前: `Laimelea Web Client`
5. 作成後、クライアントIDをメモ

### 3. Android Client IDを作成

1. 「認証情報を作成」→「OAuth クライアントID」
2. アプリケーションの種類: 「Android」
3. パッケージ名: `com.hayao0819.laimelea`
4. SHA-1 フィンガープリント: 下記コマンドで取得した値

### 4. Client IDをアプリに設定

取得したClient IDを `.env` ファイルに設定:

```env
GOOGLE_OAUTH_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
```

## SHA-1フィンガープリント取得方法

デバッグ用キーストアのSHA-1フィンガープリントを取得:

```bash
keytool -list -v \
  -keystore android/app/debug.keystore \
  -alias androiddebugkey \
  -storepass android 2>/dev/null | grep SHA1
```

リリース用キーストアの場合は、キーストアのパスとエイリアスを適宜変更してください。

`terraform output sha1_fingerprint_command` でもコマンドを確認できます。

## ステートのGCSバケット移行手順

初回の `terraform apply` ではローカルステートが使用されます。GCSバケットが作成された後、以下の手順でリモートステートに移行できます。

### 1. main.tfのバックエンド設定をアンコメント

```hcl
backend "gcs" {
  bucket = "<your-project-id>-tfstate"
  prefix = "terraform/state"
}
```

`<your-project-id>` を実際のプロジェクトIDに置き換えてください。

### 2. ステートを移行

```bash
terraform init -migrate-state
```

確認プロンプトで `yes` を入力すると、ローカルステートがGCSバケットに移行されます。

### 3. ローカルステートファイルを削除

移行が完了したら、ローカルのステートファイルを削除できます:

```bash
rm terraform.tfstate terraform.tfstate.backup
```

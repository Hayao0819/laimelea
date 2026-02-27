output "project_id" {
  description = "GCP Project ID"
  value       = google_project.laimelea.project_id
}

output "project_number" {
  description = "GCP Project Number"
  value       = google_project.laimelea.number
}

output "manual_setup_instructions" {
  description = "Steps for manual OAuth setup (not automatable via Terraform)"
  value       = <<-EOT
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

output "sha1_fingerprint_command" {
  description = "Command to get debug keystore SHA-1 fingerprint"
  value       = "keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android 2>/dev/null | grep SHA1"
}

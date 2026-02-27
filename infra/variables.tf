variable "project_id" {
  description = "GCP project ID (globally unique)"
  type        = string
}

variable "project_name" {
  description = "GCP project display name"
  type        = string
  default     = "Laimelea"
}

variable "org_id" {
  description = "GCP Organization ID (optional, for org-level projects)"
  type        = string
  default     = ""
}

variable "billing_account" {
  description = "GCP Billing Account ID"
  type        = string
}

variable "region" {
  description = "Default GCP region"
  type        = string
  default     = "asia-northeast1"
}

variable "support_email" {
  description = "Support email for OAuth consent screen (manual setup)"
  type        = string
}

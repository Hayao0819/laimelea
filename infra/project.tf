resource "google_project" "laimelea" {
  name            = var.project_name
  project_id      = var.project_id
  org_id          = var.org_id != "" ? var.org_id : null
  billing_account = var.billing_account

  labels = {
    app     = "laimelea"
    managed = "terraform"
  }
}

resource "google_storage_bucket" "tfstate" {
  name                        = "${var.project_id}-tfstate"
  location                    = var.region
  project                     = google_project.laimelea.project_id
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }
}

resource "google_project_service" "calendar_api" {
  project            = google_project.laimelea.project_id
  service            = "calendar-json.googleapis.com"
  disable_on_destroy = false

  depends_on = [google_project.laimelea]
}

resource "google_project_service" "people_api" {
  project            = google_project.laimelea.project_id
  service            = "people.googleapis.com"
  disable_on_destroy = false

  depends_on = [google_project.laimelea]
}

resource "google_project_service" "iam_credentials_api" {
  project            = google_project.laimelea.project_id
  service            = "iamcredentials.googleapis.com"
  disable_on_destroy = false

  depends_on = [google_project.laimelea]
}

resource "google_project_service" "resource_manager_api" {
  project            = google_project.laimelea.project_id
  service            = "cloudresourcemanager.googleapis.com"
  disable_on_destroy = false

  depends_on = [google_project.laimelea]
}

resource "google_project_service" "drive_api" {
  project            = google_project.laimelea.project_id
  service            = "drive.googleapis.com"
  disable_on_destroy = false

  depends_on = [google_project.laimelea]
}

export class DriveAuthExpiredError extends Error {
  constructor() {
    super("Access token expired");
    this.name = "DriveAuthExpiredError";
  }
}

export class DriveScopeDeniedError extends Error {
  constructor() {
    super("Drive appdata scope not granted");
    this.name = "DriveScopeDeniedError";
  }
}

interface DriveFileResource {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

interface DriveFileListResponse {
  files: DriveFileResource[];
  nextPageToken?: string;
}

const BACKUP_FILE_NAME = "laimelea-backup.json";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

function checkResponseStatus(status: number): void {
  if (status === 401) {
    throw new DriveAuthExpiredError();
  }
  if (status === 403) {
    throw new DriveScopeDeniedError();
  }
}

export async function findBackupFile(
  accessToken: string,
): Promise<DriveFileResource | null> {
  const url = new URL(`${DRIVE_API_BASE}/files`);
  url.searchParams.set("spaces", "appDataFolder");
  url.searchParams.set("q", `name='${BACKUP_FILE_NAME}'`);
  url.searchParams.set("fields", "files(id,name,modifiedTime,size)");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  checkResponseStatus(response.status);
  if (!response.ok) {
    throw new Error(`Google Drive API error: ${response.status}`);
  }

  const data = (await response.json()) as DriveFileListResponse;
  return data.files.length > 0 ? data.files[0] : null;
}

export async function uploadBackup(
  accessToken: string,
  data: string,
  existingFileId?: string,
): Promise<string> {
  if (existingFileId) {
    // Update existing file with PATCH
    const url = `${DRIVE_UPLOAD_BASE}/files/${existingFileId}?uploadType=media`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: data,
    });

    checkResponseStatus(response.status);
    if (!response.ok) {
      throw new Error(`Google Drive API error: ${response.status}`);
    }

    const result = (await response.json()) as { id: string };
    return result.id;
  }

  // Create new file with multipart upload
  const boundary = "laimelea_backup_boundary";
  const metadata = JSON.stringify({
    name: BACKUP_FILE_NAME,
    parents: ["appDataFolder"],
  });

  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    metadata +
    "\r\n" +
    `--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    data +
    "\r\n" +
    `--${boundary}--`;

  const url = `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  checkResponseStatus(response.status);
  if (!response.ok) {
    throw new Error(`Google Drive API error: ${response.status}`);
  }

  const result = (await response.json()) as { id: string };
  return result.id;
}

export async function downloadBackup(
  accessToken: string,
  fileId: string,
): Promise<string | null> {
  const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 404) {
    return null;
  }

  checkResponseStatus(response.status);
  if (!response.ok) {
    throw new Error(`Google Drive API error: ${response.status}`);
  }

  return response.text();
}

export async function getFileMetadata(
  accessToken: string,
  fileId: string,
): Promise<DriveFileResource | null> {
  const url = `${DRIVE_API_BASE}/files/${fileId}?fields=id,name,modifiedTime`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 404) {
    return null;
  }

  checkResponseStatus(response.status);
  if (!response.ok) {
    throw new Error(`Google Drive API error: ${response.status}`);
  }

  return response.json() as Promise<DriveFileResource>;
}

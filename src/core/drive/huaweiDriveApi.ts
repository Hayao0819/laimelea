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
  fileName: string;
  mimeType?: string;
  size?: number;
  editedTime?: string;
}

interface DriveFileListResponse {
  files: DriveFileResource[];
  nextCursor?: string;
}

const BACKUP_FILE_NAME = "laimelea-backup.json";
const DRIVE_API_BASE = "https://driveapis.cloud.huawei.com.cn/drive/v1";
const DRIVE_UPLOAD_BASE =
  "https://driveapis.cloud.huawei.com.cn/upload/drive/v1";

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
  url.searchParams.set("containers", "applicationData");
  url.searchParams.set("queryParam", `fileName='${BACKUP_FILE_NAME}'`);
  url.searchParams.set("fields", "files(id,fileName,mimeType,size,editedTime)");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  checkResponseStatus(response.status);
  if (!response.ok) {
    throw new Error(`Huawei Drive API error: ${response.status}`);
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
    // Update existing file content
    const url = `${DRIVE_UPLOAD_BASE}/files/${existingFileId}/content?uploadType=content`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: data,
    });

    checkResponseStatus(response.status);
    if (!response.ok) {
      throw new Error(`Huawei Drive API error: ${response.status}`);
    }

    const result = (await response.json()) as { id: string };
    return result.id;
  }

  // Create new file with multipart upload
  const boundary = "laimelea_backup_boundary";
  const metadata = JSON.stringify({
    fileName: BACKUP_FILE_NAME,
    parentFolder: "applicationData",
    mimeType: "application/json",
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
    throw new Error(`Huawei Drive API error: ${response.status}`);
  }

  const result = (await response.json()) as { id: string };
  return result.id;
}

export async function downloadBackup(
  accessToken: string,
  fileId: string,
): Promise<string | null> {
  const url = `${DRIVE_API_BASE}/files/${fileId}?form=content`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 404) {
    return null;
  }

  checkResponseStatus(response.status);
  if (!response.ok) {
    throw new Error(`Huawei Drive API error: ${response.status}`);
  }

  return response.text();
}

export async function getFileMetadata(
  accessToken: string,
  fileId: string,
): Promise<DriveFileResource | null> {
  const url = `${DRIVE_API_BASE}/files/${fileId}?fields=id,fileName,editedTime`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 404) {
    return null;
  }

  checkResponseStatus(response.status);
  if (!response.ok) {
    throw new Error(`Huawei Drive API error: ${response.status}`);
  }

  return response.json() as Promise<DriveFileResource>;
}

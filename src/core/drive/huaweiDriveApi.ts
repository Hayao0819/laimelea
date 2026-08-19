import {
  DRIVE_TRANSFER_TIMEOUT_MS,
  fetchWithTimeout,
} from "./fetchWithTimeout";
import { createMultipartBody } from "./multipart";

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

async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

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
  url.searchParams.set("orderBy", "editedTime desc");
  url.searchParams.set(
    "fields",
    "nextCursor,files(id,fileName,mimeType,size,editedTime)",
  );

  const files: DriveFileResource[] = [];
  let cursor: string | undefined;
  do {
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    } else {
      url.searchParams.delete("cursor");
    }
    const response = await fetchWithTimeout(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    checkResponseStatus(response.status);
    if (!response.ok) {
      throw new Error(`Huawei Drive API error: ${response.status}`);
    }

    const data = await parseJson<DriveFileListResponse>(response);
    files.push(...data.files);
    cursor = data.nextCursor;
  } while (cursor);

  return (
    files.sort(
      (a, b) =>
        new Date(b.editedTime ?? 0).getTime() -
          new Date(a.editedTime ?? 0).getTime() || a.id.localeCompare(b.id),
    )[0] ?? null
  );
}

export async function uploadBackup(
  accessToken: string,
  data: string,
  existingFileId?: string,
): Promise<string> {
  if (existingFileId) {
    const url = `${DRIVE_UPLOAD_BASE}/files/${existingFileId}/content?uploadType=content`;
    const response = await fetchWithTimeout(
      url,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: data,
      },
      DRIVE_TRANSFER_TIMEOUT_MS,
    );

    checkResponseStatus(response.status);
    if (!response.ok) {
      throw new Error(`Huawei Drive API error: ${response.status}`);
    }

    const result = await parseJson<{ id: string }>(response);
    return result.id;
  }

  const { boundary, body } = createMultipartBody(
    {
      fileName: BACKUP_FILE_NAME,
      parentFolder: "applicationData",
      mimeType: "application/json",
    },
    data,
  );

  const url = `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`;
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
    DRIVE_TRANSFER_TIMEOUT_MS,
  );

  checkResponseStatus(response.status);
  if (!response.ok) {
    throw new Error(`Huawei Drive API error: ${response.status}`);
  }

  const result = await parseJson<{ id: string }>(response);
  return result.id;
}

export async function downloadBackup(
  accessToken: string,
  fileId: string,
): Promise<string | null> {
  const url = `${DRIVE_API_BASE}/files/${fileId}?form=content`;
  const response = await fetchWithTimeout(
    url,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    DRIVE_TRANSFER_TIMEOUT_MS,
  );

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
  const response = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 404) {
    return null;
  }

  checkResponseStatus(response.status);
  if (!response.ok) {
    throw new Error(`Huawei Drive API error: ${response.status}`);
  }

  return parseJson<DriveFileResource>(response);
}

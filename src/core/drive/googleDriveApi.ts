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
  url.searchParams.set("spaces", "appDataFolder");
  url.searchParams.set("q", `name='${BACKUP_FILE_NAME}' and trashed=false`);
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set(
    "fields",
    "nextPageToken,files(id,name,modifiedTime,size)",
  );

  const files: DriveFileResource[] = [];
  let pageToken: string | undefined;
  do {
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    } else {
      url.searchParams.delete("pageToken");
    }
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    checkResponseStatus(response.status);
    if (!response.ok) {
      throw new Error(`Google Drive API error: ${response.status}`);
    }

    const data = await parseJson<DriveFileListResponse>(response);
    files.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return (
    files.sort(
      (a, b) =>
        new Date(b.modifiedTime).getTime() -
          new Date(a.modifiedTime).getTime() || a.id.localeCompare(b.id),
    )[0] ?? null
  );
}

export async function uploadBackup(
  accessToken: string,
  data: string,
  existingFileId?: string,
): Promise<string> {
  if (existingFileId) {
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

    const result = await parseJson<{ id: string }>(response);
    return result.id;
  }

  const { boundary, body } = createMultipartBody(
    {
      name: BACKUP_FILE_NAME,
      parents: ["appDataFolder"],
    },
    data,
  );

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

  const result = await parseJson<{ id: string }>(response);
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

  return parseJson<DriveFileResource>(response);
}

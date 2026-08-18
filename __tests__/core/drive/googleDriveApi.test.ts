import {
  downloadBackup,
  DriveAuthExpiredError,
  DriveScopeDeniedError,
  findBackupFile,
  getFileMetadata,
  uploadBackup,
} from "../../../src/core/drive/googleDriveApi";

const mockFetch = jest.fn();
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("findBackupFile", () => {
  it("should return file resource when backup exists", async () => {
    const file = {
      id: "file-123",
      name: "laimelea-backup.json",
      modifiedTime: "2026-02-20T10:00:00.000Z",
      size: "1024",
    };
    mockFetch.mockResolvedValueOnce(jsonResponse({ files: [file] }));

    const result = await findBackupFile("token-abc");

    expect(result).toEqual(file);
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain("spaces=appDataFolder");
    expect(callUrl).toContain("name%3D%27laimelea-backup.json%27");
    expect(new URL(callUrl).searchParams.get("q")).toContain("trashed=false");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: "Bearer token-abc" },
      }),
    );
  });

  it("should return null when no backup file exists", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ files: [] }));

    const result = await findBackupFile("token-abc");

    expect(result).toBeNull();
  });

  it("selects the newest backup deterministically", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        files: [
          {
            id: "z-old",
            name: "laimelea-backup.json",
            modifiedTime: "2026-02-20T10:00:00.000Z",
          },
          {
            id: "a-new",
            name: "laimelea-backup.json",
            modifiedTime: "2026-02-21T10:00:00.000Z",
          },
          {
            id: "b-new",
            name: "laimelea-backup.json",
            modifiedTime: "2026-02-21T10:00:00.000Z",
          },
        ],
      }),
    );

    expect(await findBackupFile("token-abc")).toMatchObject({ id: "a-new" });
  });

  it("requests every page and selects the newest backup", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          files: [
            {
              id: "old",
              name: "laimelea-backup.json",
              modifiedTime: "2026-02-20T10:00:00.000Z",
            },
          ],
          nextPageToken: "next-page",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          files: [
            {
              id: "new",
              name: "laimelea-backup.json",
              modifiedTime: "2026-02-21T10:00:00.000Z",
            },
          ],
        }),
      );

    expect(await findBackupFile("token-abc")).toMatchObject({ id: "new" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(
      new URL(mockFetch.mock.calls[0][0]).searchParams.get("orderBy"),
    ).toBe("modifiedTime desc");
    expect(
      new URL(mockFetch.mock.calls[1][0]).searchParams.get("pageToken"),
    ).toBe("next-page");
  });

  it("should throw DriveAuthExpiredError on 401", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));

    await expect(findBackupFile("expired-token")).rejects.toThrow(
      DriveAuthExpiredError,
    );
  });

  it("should throw DriveScopeDeniedError on 403", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 403));

    await expect(findBackupFile("no-scope-token")).rejects.toThrow(
      DriveScopeDeniedError,
    );
  });

  it("should throw Error on 500", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 500));

    await expect(findBackupFile("token")).rejects.toThrow(
      "Google Drive API error: 500",
    );
  });
});

describe("uploadBackup", () => {
  it("should create new file with multipart upload when no existing file", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "new-file-id" }));

    const result = await uploadBackup("token-abc", '{"alarms":[]}', undefined);

    expect(result).toBe("new-file-id");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("uploadType=multipart");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toContain("multipart/related");
    expect(options.body).toContain("laimelea-backup.json");
    expect(options.body).toContain("appDataFolder");
    expect(options.body).toContain('{"alarms":[]}');
  });

  it("regenerates a multipart boundary that appears in backup data", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1);
    jest.spyOn(Math, "random").mockReturnValue(0);
    const collidingBoundary = "laimelea_backup_1__0";
    const data = JSON.stringify({ label: `\r\n--${collidingBoundary}` });
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "new-file-id" }));

    await uploadBackup("token-abc", data);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Content-Type"]).not.toContain(collidingBoundary);
    expect(options.body).toContain(data);
    jest.restoreAllMocks();
  });

  it("should update existing file with PATCH when fileId provided", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "existing-file-id" }));

    const result = await uploadBackup(
      "token-abc",
      '{"alarms":[1,2]}',
      "existing-file-id",
    );

    expect(result).toBe("existing-file-id");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("existing-file-id");
    expect(url).toContain("uploadType=media");
    expect(options.method).toBe("PATCH");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.body).toBe('{"alarms":[1,2]}');
  });

  it("should throw DriveAuthExpiredError on 401", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));

    await expect(uploadBackup("expired", "data")).rejects.toThrow(
      DriveAuthExpiredError,
    );
  });

  it("should throw DriveScopeDeniedError on 403", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 403));

    await expect(uploadBackup("no-scope", "data")).rejects.toThrow(
      DriveScopeDeniedError,
    );
  });

  it("should throw Error on 500", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 500));

    await expect(uploadBackup("token", "data")).rejects.toThrow(
      "Google Drive API error: 500",
    );
  });
});

describe("downloadBackup", () => {
  it("should return file content as string", async () => {
    const backupData = '{"alarms":[1,2,3],"settings":{}}';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(backupData),
    });

    const result = await downloadBackup("token-abc", "file-123");

    expect(result).toBe(backupData);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("file-123");
    expect(url).toContain("alt=media");
    expect(options.headers.Authorization).toBe("Bearer token-abc");
  });

  it("should return null on 404", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve(""),
    });

    const result = await downloadBackup("token-abc", "missing-file");

    expect(result).toBeNull();
  });

  it("should throw DriveAuthExpiredError on 401", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve(""),
    });

    await expect(downloadBackup("expired", "file-id")).rejects.toThrow(
      DriveAuthExpiredError,
    );
  });

  it("should throw DriveScopeDeniedError on 403", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve(""),
    });

    await expect(downloadBackup("no-scope", "file-id")).rejects.toThrow(
      DriveScopeDeniedError,
    );
  });

  it("should throw Error on 500", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve(""),
    });

    await expect(downloadBackup("token", "file-id")).rejects.toThrow(
      "Google Drive API error: 500",
    );
  });
});

describe("getFileMetadata", () => {
  it("should return file metadata with modifiedTime", async () => {
    const metadata = {
      id: "file-123",
      name: "laimelea-backup.json",
      modifiedTime: "2026-02-20T10:30:00.000Z",
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(metadata));

    const result = await getFileMetadata("token-abc", "file-123");

    expect(result).toEqual(metadata);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("file-123");
    expect(url).toContain("fields=id,name,modifiedTime");
  });

  it("should return null on 404", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 404));

    const result = await getFileMetadata("token-abc", "missing-file");

    expect(result).toBeNull();
  });

  it("should throw DriveAuthExpiredError on 401", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));

    await expect(getFileMetadata("expired", "file-id")).rejects.toThrow(
      DriveAuthExpiredError,
    );
  });

  it("should throw DriveScopeDeniedError on 403", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 403));

    await expect(getFileMetadata("no-scope", "file-id")).rejects.toThrow(
      DriveScopeDeniedError,
    );
  });

  it("should throw Error on 500", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 500));

    await expect(getFileMetadata("token", "file-id")).rejects.toThrow(
      "Google Drive API error: 500",
    );
  });
});

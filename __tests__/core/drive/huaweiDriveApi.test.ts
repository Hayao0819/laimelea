import {
  findBackupFile,
  uploadBackup,
  downloadBackup,
  getFileMetadata,
  DriveAuthExpiredError,
  DriveScopeDeniedError,
} from "../../../src/core/drive/huaweiDriveApi";

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("huaweiDriveApi", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("findBackupFile", () => {
    it("should return file when found", async () => {
      const file = {
        id: "file-1",
        fileName: "laimelea-backup.json",
        editedTime: "2026-02-20T10:00:00.000Z",
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [file] }),
      });

      const result = await findBackupFile("token-123");

      expect(result).toEqual(file);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("driveapis.cloud.huawei.com.cn/drive/v1/files");
      expect(url).toContain("containers=applicationData");
    });

    it("should return null when no files found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      });

      const result = await findBackupFile("token-123");

      expect(result).toBeNull();
    });

    it("should throw DriveAuthExpiredError on 401", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(findBackupFile("expired-token")).rejects.toThrow(
        DriveAuthExpiredError,
      );
    });

    it("should throw DriveScopeDeniedError on 403", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await expect(findBackupFile("token")).rejects.toThrow(
        DriveScopeDeniedError,
      );
    });
  });

  describe("uploadBackup", () => {
    it("should create new file with multipart upload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "new-file-id" }),
      });

      const result = await uploadBackup("token", '{"alarms":[]}');

      expect(result).toBe("new-file-id");
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("uploadType=multipart");
      expect(options.method).toBe("POST");
      expect(options.headers["Content-Type"]).toContain(
        "multipart/related; boundary=",
      );
      expect(options.body).toContain("laimelea-backup.json");
      expect(options.body).toContain("applicationData");
    });

    it("should update existing file with PUT", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "existing-id" }),
      });

      const result = await uploadBackup(
        "token",
        '{"alarms":[]}',
        "existing-id",
      );

      expect(result).toBe("existing-id");
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("existing-id");
      expect(url).toContain("uploadType=content");
      expect(options.method).toBe("PUT");
    });

    it("should throw DriveAuthExpiredError on 401", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(uploadBackup("token", "data")).rejects.toThrow(
        DriveAuthExpiredError,
      );
    });
  });

  describe("downloadBackup", () => {
    it("should download file content", async () => {
      const content = '{"settings":{"lang":"ja"}}';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(content),
      });

      const result = await downloadBackup("token", "file-id");

      expect(result).toBe(content);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("file-id");
      expect(url).toContain("form=content");
    });

    it("should return null on 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await downloadBackup("token", "missing-id");

      expect(result).toBeNull();
    });

    it("should throw DriveAuthExpiredError on 401", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(downloadBackup("token", "file-id")).rejects.toThrow(
        DriveAuthExpiredError,
      );
    });
  });

  describe("getFileMetadata", () => {
    it("should return file metadata", async () => {
      const metadata = {
        id: "file-1",
        fileName: "laimelea-backup.json",
        editedTime: "2026-02-20T10:30:00.000Z",
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(metadata),
      });

      const result = await getFileMetadata("token", "file-1");

      expect(result).toEqual(metadata);
    });

    it("should return null on 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await getFileMetadata("token", "missing-id");

      expect(result).toBeNull();
    });
  });
});

import { createHmsBackupService } from "../../../../src/core/platform/hms/backupService";
import type { PlatformAuthService } from "../../../../src/core/platform/types";
import {
  findBackupFile,
  uploadBackup,
  downloadBackup,
  getFileMetadata,
} from "../../../../src/core/drive/huaweiDriveApi";

jest.mock("../../../../src/core/drive/huaweiDriveApi", () => ({
  ...jest.requireActual("../../../../src/core/drive/huaweiDriveApi"),
  findBackupFile: jest.fn(),
  uploadBackup: jest.fn(),
  downloadBackup: jest.fn(),
  getFileMetadata: jest.fn(),
}));

const mockFindBackupFile = findBackupFile as jest.MockedFunction<
  typeof findBackupFile
>;
const mockUploadBackup = uploadBackup as jest.MockedFunction<
  typeof uploadBackup
>;
const mockDownloadBackup = downloadBackup as jest.MockedFunction<
  typeof downloadBackup
>;
const mockGetFileMetadata = getFileMetadata as jest.MockedFunction<
  typeof getFileMetadata
>;

function createMockAuthService(
  accessToken: string | null = "mock-token",
): PlatformAuthService {
  return {
    signIn: jest.fn(),
    signOut: jest.fn(),
    getAccessToken: jest.fn(() => Promise.resolve(accessToken)),
    isAvailable: jest.fn(() => Promise.resolve(true)),
  };
}

describe("createHmsBackupService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isAvailable", () => {
    it("should return true when signed in", async () => {
      const auth = createMockAuthService("valid-token");
      const service = createHmsBackupService(auth);

      expect(await service.isAvailable()).toBe(true);
      expect(auth.getAccessToken).toHaveBeenCalled();
    });

    it("should return false when not signed in", async () => {
      const auth = createMockAuthService(null);
      const service = createHmsBackupService(auth);

      expect(await service.isAvailable()).toBe(false);
    });
  });

  describe("backup", () => {
    it("should upload new backup when no existing file", async () => {
      const auth = createMockAuthService("valid-token");
      const service = createHmsBackupService(auth);
      const data = JSON.stringify({ alarms: [1, 2, 3] });

      mockFindBackupFile.mockResolvedValueOnce(null);
      mockUploadBackup.mockResolvedValueOnce("new-file-id");

      await service.backup(data);

      expect(mockFindBackupFile).toHaveBeenCalledWith("valid-token");
      expect(mockUploadBackup).toHaveBeenCalledWith(
        "valid-token",
        data,
        undefined,
      );
    });

    it("should update existing backup when file exists", async () => {
      const auth = createMockAuthService("valid-token");
      const service = createHmsBackupService(auth);
      const data = JSON.stringify({ alarms: [4, 5, 6] });

      mockFindBackupFile.mockResolvedValueOnce({
        id: "existing-id",
        fileName: "laimelea-backup.json",
        editedTime: "2026-02-20T10:00:00.000Z",
      });
      mockUploadBackup.mockResolvedValueOnce("existing-id");

      await service.backup(data);

      expect(mockUploadBackup).toHaveBeenCalledWith(
        "valid-token",
        data,
        "existing-id",
      );
    });

    it("should throw when not signed in", async () => {
      const auth = createMockAuthService(null);
      const service = createHmsBackupService(auth);

      await expect(service.backup("data")).rejects.toThrow("Not signed in");
      expect(mockFindBackupFile).not.toHaveBeenCalled();
    });

    it("should propagate Drive API errors", async () => {
      const auth = createMockAuthService("valid-token");
      const service = createHmsBackupService(auth);

      const driveError = new Error("Access token expired");
      driveError.name = "DriveAuthExpiredError";
      mockFindBackupFile.mockRejectedValueOnce(driveError);

      await expect(service.backup("data")).rejects.toThrow(
        "Access token expired",
      );
    });
  });

  describe("restore", () => {
    it("should download backup from Drive", async () => {
      const auth = createMockAuthService("valid-token");
      const service = createHmsBackupService(auth);
      const backupData = JSON.stringify({ settings: { lang: "ja" } });

      mockFindBackupFile.mockResolvedValueOnce({
        id: "file-123",
        fileName: "laimelea-backup.json",
        editedTime: "2026-02-20T10:00:00.000Z",
      });
      mockDownloadBackup.mockResolvedValueOnce(backupData);

      const result = await service.restore();

      expect(result).toBe(backupData);
      expect(mockFindBackupFile).toHaveBeenCalledWith("valid-token");
      expect(mockDownloadBackup).toHaveBeenCalledWith(
        "valid-token",
        "file-123",
      );
    });

    it("should return null when no backup file on Drive", async () => {
      const auth = createMockAuthService("valid-token");
      const service = createHmsBackupService(auth);

      mockFindBackupFile.mockResolvedValueOnce(null);

      const result = await service.restore();

      expect(result).toBeNull();
      expect(mockDownloadBackup).not.toHaveBeenCalled();
    });

    it("should return null when not signed in", async () => {
      const auth = createMockAuthService(null);
      const service = createHmsBackupService(auth);

      const result = await service.restore();

      expect(result).toBeNull();
      expect(mockFindBackupFile).not.toHaveBeenCalled();
    });
  });

  describe("getLastBackupTime", () => {
    it("should return editedTime as Unix ms", async () => {
      const auth = createMockAuthService("valid-token");
      const service = createHmsBackupService(auth);
      const editedTime = "2026-02-20T10:30:00.000Z";

      mockFindBackupFile.mockResolvedValueOnce({
        id: "file-123",
        fileName: "laimelea-backup.json",
        editedTime,
      });
      mockGetFileMetadata.mockResolvedValueOnce({
        id: "file-123",
        fileName: "laimelea-backup.json",
        editedTime,
      });

      const result = await service.getLastBackupTime();

      expect(result).toBe(new Date(editedTime).getTime());
      expect(mockGetFileMetadata).toHaveBeenCalledWith(
        "valid-token",
        "file-123",
      );
    });

    it("should return null when no backup file", async () => {
      const auth = createMockAuthService("valid-token");
      const service = createHmsBackupService(auth);

      mockFindBackupFile.mockResolvedValueOnce(null);

      const result = await service.getLastBackupTime();

      expect(result).toBeNull();
      expect(mockGetFileMetadata).not.toHaveBeenCalled();
    });

    it("should return null when not signed in", async () => {
      const auth = createMockAuthService(null);
      const service = createHmsBackupService(auth);

      const result = await service.getLastBackupTime();

      expect(result).toBeNull();
    });

    it("should return null when metadata returns null", async () => {
      const auth = createMockAuthService("valid-token");
      const service = createHmsBackupService(auth);

      mockFindBackupFile.mockResolvedValueOnce({
        id: "file-123",
        fileName: "laimelea-backup.json",
        editedTime: "2026-02-20T10:00:00.000Z",
      });
      mockGetFileMetadata.mockResolvedValueOnce(null);

      const result = await service.getLastBackupTime();

      expect(result).toBeNull();
    });
  });
});

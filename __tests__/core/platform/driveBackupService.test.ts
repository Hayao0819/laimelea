import { createDriveBackupService } from "../../../src/core/platform/driveBackupService";
import type { PlatformAuthService } from "../../../src/core/platform/types";

interface TestFile {
  id: string;
  updatedAt?: string;
}

function createAuthService(
  accessToken: string | null = "access-token",
): PlatformAuthService {
  return {
    signIn: jest.fn(),
    signOut: jest.fn(),
    getAccessToken: jest.fn(() => Promise.resolve(accessToken)),
    isAvailable: jest.fn(() => Promise.resolve(true)),
  };
}

function createAdapter() {
  return {
    findBackupFile: jest.fn<Promise<TestFile | null>, [string]>(),
    uploadBackup: jest.fn<Promise<string>, [string, string, string?]>(),
    downloadBackup: jest.fn<Promise<string | null>, [string, string]>(),
    getFileMetadata: jest.fn<Promise<TestFile | null>, [string, string]>(),
    getModifiedTime: jest.fn<string | undefined, [TestFile]>(
      (file) => file.updatedAt,
    ),
  };
}

describe("createDriveBackupService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes provider-specific timestamps through the shared backup flow", async () => {
    const adapter = createAdapter();
    adapter.findBackupFile.mockResolvedValue({ id: "backup-file" });
    adapter.getFileMetadata.mockResolvedValue({
      id: "backup-file",
      updatedAt: "2026-08-18T01:23:45.000Z",
    });

    const service = createDriveBackupService(createAuthService(), adapter);

    await expect(service.getLastBackupTime()).resolves.toBe(
      new Date("2026-08-18T01:23:45.000Z").getTime(),
    );
    expect(adapter.getModifiedTime).toHaveBeenCalledWith({
      id: "backup-file",
      updatedAt: "2026-08-18T01:23:45.000Z",
    });
  });

  it("returns null when the provider does not expose a backup timestamp", async () => {
    const adapter = createAdapter();
    adapter.findBackupFile.mockResolvedValue({ id: "backup-file" });
    adapter.getFileMetadata.mockResolvedValue({ id: "backup-file" });

    const service = createDriveBackupService(createAuthService(), adapter);

    await expect(service.getLastBackupTime()).resolves.toBeNull();
  });

  it("returns null when the provider timestamp is invalid", async () => {
    const adapter = createAdapter();
    adapter.findBackupFile.mockResolvedValue({ id: "backup-file" });
    adapter.getFileMetadata.mockResolvedValue({
      id: "backup-file",
      updatedAt: "invalid",
    });

    const service = createDriveBackupService(createAuthService(), adapter);

    await expect(service.getLastBackupTime()).resolves.toBeNull();
  });

  it("serializes backups while retaining their order", async () => {
    const adapter = createAdapter();
    let finishFirstFind: (file: TestFile | null) => void;
    let markFirstFindStarted: () => void;
    const firstFindStarted = new Promise<void>((resolve) => {
      markFirstFindStarted = resolve;
    });
    adapter.findBackupFile
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            markFirstFindStarted();
            finishFirstFind = resolve;
          }),
      )
      .mockResolvedValueOnce(null);
    adapter.uploadBackup.mockResolvedValue("backup-file");

    const service = createDriveBackupService(createAuthService(), adapter);
    const first = service.backup("first");
    const second = service.backup("second");
    await firstFindStarted;

    expect(adapter.findBackupFile).toHaveBeenCalledTimes(1);
    finishFirstFind!(null);
    await Promise.all([first, second]);

    expect(adapter.uploadBackup).toHaveBeenNthCalledWith(
      1,
      "access-token",
      "first",
      undefined,
    );
    expect(adapter.uploadBackup).toHaveBeenNthCalledWith(
      2,
      "access-token",
      "second",
      undefined,
    );
  });
});

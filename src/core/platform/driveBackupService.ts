import type { PlatformAuthService, PlatformBackupService } from "./types";

interface BackupFile {
  id: string;
}

interface DriveBackupAdapter<TFile extends BackupFile> {
  findBackupFile(accessToken: string): Promise<TFile | null>;
  uploadBackup(
    accessToken: string,
    data: string,
    existingFileId?: string,
  ): Promise<string>;
  downloadBackup(accessToken: string, fileId: string): Promise<string | null>;
  getFileMetadata(accessToken: string, fileId: string): Promise<TFile | null>;
  getModifiedTime(file: TFile): string | null | undefined;
}

export function createDriveBackupService<TFile extends BackupFile>(
  authService: PlatformAuthService,
  adapter: DriveBackupAdapter<TFile>,
): PlatformBackupService {
  let queuedOperation = Promise.resolve();

  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const task = queuedOperation.then(operation);
    queuedOperation = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };

  return {
    async isAvailable() {
      const token = await authService.getAccessToken();
      return token != null;
    },

    async backup(data: string) {
      return serialize(async () => {
        const token = await authService.getAccessToken();
        if (token == null) throw new Error("Not signed in");
        const existing = await adapter.findBackupFile(token);
        await adapter.uploadBackup(token, data, existing?.id);
      });
    },

    async restore() {
      return serialize(async () => {
        const token = await authService.getAccessToken();
        if (token == null) return null;
        const file = await adapter.findBackupFile(token);
        if (file == null) return null;
        return adapter.downloadBackup(token, file.id);
      });
    },

    async getLastBackupTime() {
      const token = await authService.getAccessToken();
      if (token == null) {
        return null;
      }

      const file = await adapter.findBackupFile(token);
      if (file == null) {
        return null;
      }

      const metadata = await adapter.getFileMetadata(token, file.id);
      if (metadata == null) {
        return null;
      }

      const modifiedTime = adapter.getModifiedTime(metadata);
      if (modifiedTime == null) {
        return null;
      }
      const timestamp = Date.parse(modifiedTime);
      return Number.isFinite(timestamp) ? timestamp : null;
    },
  };
}

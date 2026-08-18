import {
  downloadBackup,
  findBackupFile,
  getFileMetadata,
  uploadBackup,
} from "../../drive/googleDriveApi";
import type { PlatformAuthService, PlatformBackupService } from "../types";

export function createGmsBackupService(
  authService: PlatformAuthService,
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
        const existing = await findBackupFile(token);
        await uploadBackup(token, data, existing?.id);
      });
    },

    async restore() {
      return serialize(async () => {
        const token = await authService.getAccessToken();
        if (token == null) return null;
        const file = await findBackupFile(token);
        if (file == null) return null;
        return downloadBackup(token, file.id);
      });
    },

    async getLastBackupTime() {
      const token = await authService.getAccessToken();
      if (token == null) {
        return null;
      }

      const file = await findBackupFile(token);
      if (file == null) {
        return null;
      }

      const metadata = await getFileMetadata(token, file.id);
      if (metadata == null) {
        return null;
      }

      return new Date(metadata.modifiedTime).getTime();
    },
  };
}

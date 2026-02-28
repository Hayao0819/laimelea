import {
  downloadBackup,
  findBackupFile,
  getFileMetadata,
  uploadBackup,
} from "../../drive/huaweiDriveApi";
import type { PlatformAuthService, PlatformBackupService } from "../types";

export function createHmsBackupService(
  authService: PlatformAuthService,
): PlatformBackupService {
  return {
    async isAvailable() {
      const token = await authService.getAccessToken();
      return token != null;
    },

    async backup(data: string) {
      const token = await authService.getAccessToken();
      if (token == null) {
        throw new Error("Not signed in");
      }

      const existing = await findBackupFile(token);
      await uploadBackup(token, data, existing?.id);
    },

    async restore() {
      const token = await authService.getAccessToken();
      if (token == null) {
        return null;
      }

      const file = await findBackupFile(token);
      if (file == null) {
        return null;
      }

      return downloadBackup(token, file.id);
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
      if (metadata?.editedTime == null) {
        return null;
      }

      return new Date(metadata.editedTime).getTime();
    },
  };
}

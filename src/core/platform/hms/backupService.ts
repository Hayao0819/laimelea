import {
  downloadBackup,
  findBackupFile,
  getFileMetadata,
  uploadBackup,
} from "../../drive/huaweiDriveApi";
import { createDriveBackupService } from "../driveBackupService";
import type { PlatformAuthService, PlatformBackupService } from "../types";

export function createHmsBackupService(
  authService: PlatformAuthService,
): PlatformBackupService {
  return createDriveBackupService(authService, {
    findBackupFile,
    uploadBackup,
    downloadBackup,
    getFileMetadata,
    getModifiedTime: (file) => file.editedTime,
  });
}

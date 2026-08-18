import {
  downloadBackup,
  findBackupFile,
  getFileMetadata,
  uploadBackup,
} from "../../drive/googleDriveApi";
import { createDriveBackupService } from "../driveBackupService";
import type { PlatformAuthService, PlatformBackupService } from "../types";

export function createGmsBackupService(
  authService: PlatformAuthService,
): PlatformBackupService {
  return createDriveBackupService(authService, {
    findBackupFile,
    uploadBackup,
    downloadBackup,
    getFileMetadata,
    getModifiedTime: (file) => file.modifiedTime,
  });
}

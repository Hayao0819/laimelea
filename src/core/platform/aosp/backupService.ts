import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../storage/keys";
import type { PlatformBackupService } from "../types";

export function createAospBackupService(): PlatformBackupService {
  return {
    async isAvailable() {
      return true;
    },

    async backup(data: string) {
      await AsyncStorage.setItem(STORAGE_KEYS.BACKUP_DATA, data);
      await AsyncStorage.setItem(
        STORAGE_KEYS.BACKUP_TIMESTAMP,
        String(Date.now()),
      );
    },

    async restore() {
      return AsyncStorage.getItem(STORAGE_KEYS.BACKUP_DATA);
    },

    async getLastBackupTime() {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.BACKUP_TIMESTAMP);
      return raw ? Number(raw) : null;
    },
  };
}

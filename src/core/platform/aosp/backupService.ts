import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../storage/keys";
import type { PlatformBackupService } from "../types";

interface LocalBackupSnapshot {
  data: string;
  timestamp: number;
}

async function readSnapshot(): Promise<LocalBackupSnapshot | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.BACKUP_SNAPSHOT);
  if (raw == null) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      !("data" in value) ||
      !("timestamp" in value) ||
      typeof value.data !== "string" ||
      typeof value.timestamp !== "number" ||
      !Number.isFinite(value.timestamp)
    ) {
      return null;
    }
    return { data: value.data, timestamp: value.timestamp };
  } catch {
    return null;
  }
}

export function createAospBackupService(): PlatformBackupService {
  return {
    async isAvailable() {
      return true;
    },

    async backup(data: string) {
      const timestamp = Date.now();
      await Promise.all([
        AsyncStorage.setItem(
          STORAGE_KEYS.BACKUP_SNAPSHOT,
          JSON.stringify({ data, timestamp }),
        ),
        AsyncStorage.setItem(STORAGE_KEYS.BACKUP_DATA, data),
        AsyncStorage.setItem(STORAGE_KEYS.BACKUP_TIMESTAMP, String(timestamp)),
      ]);
    },

    async restore() {
      const snapshot = await readSnapshot();
      return snapshot?.data ?? AsyncStorage.getItem(STORAGE_KEYS.BACKUP_DATA);
    },

    async getLastBackupTime() {
      const snapshot = await readSnapshot();
      if (snapshot != null) return snapshot.timestamp;
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.BACKUP_TIMESTAMP);
      if (!raw) return null;
      const timestamp = Number(raw);
      return Number.isFinite(timestamp) ? timestamp : null;
    },
  };
}

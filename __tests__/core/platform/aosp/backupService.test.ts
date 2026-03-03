import AsyncStorage from "@react-native-async-storage/async-storage";

import { createAospBackupService } from "../../../../src/core/platform/aosp/backupService";
import { STORAGE_KEYS } from "../../../../src/core/storage/keys";

const mockStore: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStore[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStore[key];
      return Promise.resolve();
    }),
  },
}));

function clearMockStore(): void {
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key];
  }
}

describe("createAospBackupService", () => {
  beforeEach(() => {
    clearMockStore();
    jest.clearAllMocks();
  });

  describe("isAvailable", () => {
    it("should always return true", async () => {
      const service = createAospBackupService();
      expect(await service.isAvailable()).toBe(true);
    });
  });

  describe("backup", () => {
    it("should save data and timestamp to AsyncStorage", async () => {
      const service = createAospBackupService();
      const data = JSON.stringify({ alarms: [1, 2, 3] });

      const before = Date.now();
      await service.backup(data);
      const after = Date.now();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BACKUP_DATA,
        data,
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);

      expect(mockStore[STORAGE_KEYS.BACKUP_DATA]).toBe(data);

      const timestamp = Number(mockStore[STORAGE_KEYS.BACKUP_TIMESTAMP]);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("restore", () => {
    it("should return stored backup data", async () => {
      const service = createAospBackupService();
      const data = JSON.stringify({ settings: { theme: "dark" } });
      mockStore[STORAGE_KEYS.BACKUP_DATA] = data;

      const result = await service.restore();
      expect(result).toBe(data);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BACKUP_DATA,
      );
    });

    it("should return null when no backup", async () => {
      const service = createAospBackupService();
      const result = await service.restore();
      expect(result).toBeNull();
    });
  });

  describe("getLastBackupTime", () => {
    it("should return timestamp as number", async () => {
      const service = createAospBackupService();
      const timestamp = 1700000000000;
      mockStore[STORAGE_KEYS.BACKUP_TIMESTAMP] = String(timestamp);

      const result = await service.getLastBackupTime();
      expect(result).toBe(timestamp);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BACKUP_TIMESTAMP,
      );
    });

    it("should return null when no timestamp", async () => {
      const service = createAospBackupService();
      const result = await service.getLastBackupTime();
      expect(result).toBeNull();
    });
  });
});

import type { PlatformSleepService } from "../types";

export function createGmsSleepService(): PlatformSleepService {
  return {
    async isAvailable() {
      return false;
    },

    async fetchSleepSessions() {
      return [];
    },
  };
}

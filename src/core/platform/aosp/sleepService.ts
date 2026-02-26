import type { PlatformSleepService } from "../types";

export function createAospSleepService(): PlatformSleepService {
  return {
    async isAvailable() {
      return false;
    },

    async fetchSleepSessions() {
      return [];
    },
  };
}

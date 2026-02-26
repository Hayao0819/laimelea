import type { PlatformCalendarService } from "../types";

export function createAospCalendarService(): PlatformCalendarService {
  return {
    async isAvailable() {
      return false;
    },

    async fetchEvents() {
      return [];
    },

    async getCalendarList() {
      return [];
    },
  };
}

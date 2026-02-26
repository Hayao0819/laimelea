import type { PlatformCalendarService } from "../types";

export function createGmsCalendarService(): PlatformCalendarService {
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

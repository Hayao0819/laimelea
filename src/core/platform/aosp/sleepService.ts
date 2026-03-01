import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../storage/keys";
import type { SleepSession } from "../../../models/SleepSession";
import type { PlatformSleepService } from "../types";

export function createAospSleepService(): PlatformSleepService {
  return {
    async isAvailable() {
      return true;
    },

    async requestPermissions() {
      return true;
    },

    async fetchSleepSessions(
      startMs: number,
      endMs: number,
    ): Promise<SleepSession[]> {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.SLEEP_SESSIONS);
        if (raw == null) return [];

        const sessions: SleepSession[] = JSON.parse(raw);
        return sessions.filter(
          (s) =>
            s.source === "manual" &&
            s.startTimestampMs >= startMs &&
            s.startTimestampMs < endMs,
        );
      } catch {
        return [];
      }
    },
  };
}

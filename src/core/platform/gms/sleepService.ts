import {
  initialize,
  readRecords,
  SleepStageType,
} from "react-native-health-connect";
import type { SleepSession } from "../../../models/SleepSession";
import type { SleepStageType as AppSleepStageType } from "../../../models/SleepSession";
import type { PlatformSleepService } from "../types";

const STAGE_MAP: Record<number, AppSleepStageType> = {
  [SleepStageType.UNKNOWN]: "unknown",
  [SleepStageType.AWAKE]: "awake",
  [SleepStageType.SLEEPING]: "sleeping",
  [SleepStageType.OUT_OF_BED]: "out_of_bed",
  [SleepStageType.LIGHT]: "light",
  [SleepStageType.DEEP]: "deep",
  [SleepStageType.REM]: "rem",
};

function mapStageType(stage: number): AppSleepStageType {
  return STAGE_MAP[stage] ?? "unknown";
}

export function createGmsSleepService(): PlatformSleepService {
  return {
    async isAvailable() {
      try {
        return await initialize();
      } catch {
        return false;
      }
    },

    async fetchSleepSessions(
      startMs: number,
      endMs: number,
    ): Promise<SleepSession[]> {
      try {
        const result = await readRecords("SleepSession", {
          timeRangeFilter: {
            operator: "between",
            startTime: new Date(startMs).toISOString(),
            endTime: new Date(endMs).toISOString(),
          },
        });

        return result.records.map((record) => {
          const startTimestampMs = new Date(record.startTime).getTime();
          const endTimestampMs = new Date(record.endTime).getTime();

          return {
            id: `hc-${startTimestampMs}-${endTimestampMs}`,
            source: "health_connect" as const,
            startTimestampMs,
            endTimestampMs,
            stages: (record.stages ?? []).map((stage) => ({
              startTimestampMs: new Date(stage.startTime).getTime(),
              endTimestampMs: new Date(stage.endTime).getTime(),
              stage: mapStageType(stage.stage),
            })),
            durationMs: endTimestampMs - startTimestampMs,
            createdAt: startTimestampMs,
            updatedAt: startTimestampMs,
          };
        });
      } catch {
        return [];
      }
    },
  };
}

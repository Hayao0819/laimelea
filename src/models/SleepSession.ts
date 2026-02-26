export type SleepStageType =
  | "unknown"
  | "awake"
  | "sleeping"
  | "out_of_bed"
  | "awake_in_bed"
  | "light"
  | "deep"
  | "rem";

export interface SleepStage {
  startTimestampMs: number;
  endTimestampMs: number;
  stage: SleepStageType;
}

export interface SleepSession {
  id: string;
  source: "health_connect" | "manual";
  startTimestampMs: number;
  endTimestampMs: number;
  stages: SleepStage[];
  durationMs: number;
  createdAt: number;
  updatedAt: number;
}

export interface CycleEstimation {
  periodMinutes: number;
  driftMinutesPerDay: number;
  r2: number;
  confidence: "low" | "medium" | "high";
  dataPointsUsed: number;
}

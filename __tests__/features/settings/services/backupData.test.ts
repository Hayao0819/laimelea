import {
  createDefaultStore,
  createNewGame,
} from "../../../../src/features/game2048/logic/gameEngine";
import {
  createBackupData,
  parseBackupData,
  parseBackupDataResult,
} from "../../../../src/features/settings/services/backupData";
import type { Alarm } from "../../../../src/models/Alarm";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";
import type { SleepSession } from "../../../../src/models/SleepSession";

function createAlarm(id: string): Alarm {
  return {
    id,
    label: "Wake up",
    enabled: true,
    targetTimestampMs: 2_000_000_000_000,
    recurrenceAnchorTimestampMs: null,
    setInTimeSystem: "24h",
    repeat: null,
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    snoozeCount: 0,
    autoSilenceMin: 0,
    soundUri: null,
    vibrationEnabled: true,
    notifeeTriggerId: null,
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    mathDifficulty: 1,
    lastFiredAt: null,
    activeOccurrenceTimestampMs: null,
    lastDeliveredOccurrenceTimestampMs: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

function createSleepSession(id: string): SleepSession {
  return {
    id,
    source: "manual",
    startTimestampMs: 1,
    endTimestampMs: 2,
    stages: [],
    durationMs: 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

function createBackup(
  alarms: Alarm[] = [],
  sleepSessions: SleepSession[] = [],
): string {
  return JSON.stringify({
    version: 1,
    timestamp: 1,
    settings: DEFAULT_SETTINGS,
    alarms,
    sleepSessions,
    game2048: createDefaultStore(),
  });
}

describe("parseBackupData", () => {
  it("normalizes legacy v1 fields and removes unknown keys", () => {
    const raw = JSON.parse(createBackup([createAlarm("alarm")])) as {
      settings: Record<string, unknown>;
      alarms: Record<string, unknown>[];
      game2048: Record<string, unknown>;
    };
    delete raw.settings.secondaryTimezone;
    delete raw.settings.lastBackupTimestamp;
    delete raw.alarms[0].recurrenceAnchorTimestampMs;
    delete raw.alarms[0].activeOccurrenceTimestampMs;
    delete raw.alarms[0].lastDeliveredOccurrenceTimestampMs;
    delete raw.alarms[0].mathDifficulty;
    raw.alarms[0].linkedEventOffset = raw.alarms[0].linkedEventOffsetMs;
    delete raw.alarms[0].linkedEventOffsetMs;
    delete raw.game2048.perSizeGames;
    delete raw.game2048.settings;
    delete raw.game2048.activeSnapshotId;
    delete raw.game2048.autoSaveMaxTile;
    raw.settings.untrustedSetting = true;
    raw.alarms[0].untrustedAlarmField = true;

    const restored = parseBackupData(JSON.stringify(raw));

    expect(restored).not.toBeNull();
    expect(restored!.settings.secondaryTimezone).toBeNull();
    expect(restored!.settings.lastBackupTimestamp).toBeNull();
    expect(restored!.alarms[0]).toMatchObject({
      recurrenceAnchorTimestampMs: null,
      activeOccurrenceTimestampMs: null,
      lastDeliveredOccurrenceTimestampMs: null,
      mathDifficulty: 1,
    });
    expect(restored!.settings).not.toHaveProperty("untrustedSetting");
    expect(restored!.alarms[0]).not.toHaveProperty("untrustedAlarmField");
    expect(restored!.game2048.settings).toEqual({ luckyMode: false });
    expect(restored!.game2048.activeSnapshotId).toBeNull();
  });

  it("accepts alarms saved before linked calendar source IDs existed", () => {
    const parsed = parseBackupData(createBackup([createAlarm("legacy")]));

    expect(parsed?.alarms[0]).toMatchObject({
      id: "legacy",
      linkedCalendarSourceEventId: null,
    });
  });

  it("rejects duplicate alarm IDs before scheduling can begin", () => {
    expect(
      parseBackupData(createBackup([createAlarm("same"), createAlarm("same")])),
    ).toBeNull();
  });

  it("rejects duplicate sleep IDs before storage writes", () => {
    expect(
      parseBackupData(
        createBackup(
          [],
          [createSleepSession("same"), createSleepSession("same")],
        ),
      ),
    ).toBeNull();
  });

  it("rejects a sleep duration that does not match its timestamps", () => {
    const session = createSleepSession("duration-mismatch");
    session.durationMs = 2;

    expect(parseBackupData(createBackup([], [session]))).toBeNull();
  });

  it("rejects sleep stages outside their session range", () => {
    const session = createSleepSession("out-of-range-stage");
    session.stages = [
      { startTimestampMs: 0, endTimestampMs: 1, stage: "light" },
    ];

    expect(parseBackupData(createBackup([], [session]))).toBeNull();
  });

  it.each([
    [
      "negative calendar reminder",
      (raw: any) => {
        raw.settings.defaultEventReminderMin = -1;
      },
    ],
    [
      "negative widget opacity",
      (raw: any) => {
        raw.settings.widgetSettings.opacity = -1;
      },
    ],
    [
      "widget opacity above 100",
      (raw: any) => {
        raw.settings.widgetSettings.opacity = 101;
      },
    ],
    [
      "negative widget border radius",
      (raw: any) => {
        raw.settings.widgetSettings.borderRadius = -1;
      },
    ],
    [
      "negative default snooze duration",
      (raw: any) => {
        raw.settings.alarmDefaults.snoozeDurationMin = -1;
      },
    ],
    [
      "negative alarm snooze duration",
      (raw: any) => {
        raw.alarms[0].snoozeDurationMin = -1;
      },
    ],
    [
      "snooze count above its maximum",
      (raw: any) => {
        raw.alarms[0].snoozeCount = raw.alarms[0].snoozeMaxCount + 1;
      },
    ],
    [
      "negative game score",
      (raw: any) => {
        raw.game2048.currentGame.score = -1;
      },
    ],
    [
      "negative game move count",
      (raw: any) => {
        raw.game2048.currentGame.moveCount = -1;
      },
    ],
    [
      "a non-power-of-two tile",
      (raw: any) => {
        raw.game2048.currentGame.board[0][0] = 3;
      },
    ],
    [
      "negative best score",
      (raw: any) => {
        raw.game2048.bestScores["4"] = -1;
      },
    ],
    [
      "negative autosave tile",
      (raw: any) => {
        raw.game2048.autoSaveMaxTile["4"] = -1;
      },
    ],
  ])("rejects %s", (_description, mutate) => {
    const raw = JSON.parse(createBackup([createAlarm("alarm")])) as any;
    mutate(raw);

    expect(parseBackupData(JSON.stringify(raw))).toBeNull();
  });

  it.each([
    [
      "duplicate snapshot IDs",
      (raw: any) => {
        const snapshot = {
          id: "snapshot",
          name: "Snapshot",
          state: raw.game2048.currentGame,
          timestamp: 1,
          parentSnapshotId: null,
        };
        raw.game2048.snapshots = [snapshot, { ...snapshot }];
      },
    ],
    [
      "a missing active snapshot",
      (raw: any) => {
        raw.game2048.activeSnapshotId = "missing";
      },
    ],
    [
      "a missing snapshot parent",
      (raw: any) => {
        raw.game2048.snapshots = [
          {
            id: "snapshot",
            name: "Snapshot",
            state: raw.game2048.currentGame,
            timestamp: 1,
            parentSnapshotId: "missing",
          },
        ];
      },
    ],
    [
      "a snapshot parent cycle",
      (raw: any) => {
        raw.game2048.snapshots = [
          {
            id: "first",
            name: "First",
            state: raw.game2048.currentGame,
            timestamp: 1,
            parentSnapshotId: "second",
          },
          {
            id: "second",
            name: "Second",
            state: raw.game2048.currentGame,
            timestamp: 2,
            parentSnapshotId: "first",
          },
        ];
      },
    ],
    [
      "current history from another board size",
      (raw: any) => {
        raw.game2048.history = [createNewGame(3)];
      },
    ],
    [
      "a per-size game under the wrong key",
      (raw: any) => {
        raw.game2048.perSizeGames = {
          3: { game: createNewGame(4), history: [] },
        };
      },
    ],
    [
      "a per-size history from another board size",
      (raw: any) => {
        raw.game2048.perSizeGames = {
          3: { game: createNewGame(3), history: [createNewGame(4)] },
        };
      },
    ],
    [
      "too many alarms",
      (raw: any) => {
        raw.alarms = Array.from({ length: 1001 }, (_, index) =>
          createAlarm(`alarm-${index}`),
        );
      },
    ],
  ])("rejects %s", (_description, mutate) => {
    const raw = JSON.parse(createBackup([createAlarm("alarm")])) as any;
    mutate(raw);

    expect(parseBackupData(JSON.stringify(raw))).toBeNull();
  });
});

describe("createBackupData", () => {
  it("creates a valid backup payload under the caps", () => {
    const result = createBackupData({
      timestamp: 1,
      settings: DEFAULT_SETTINGS,
      alarms: [createAlarm("alarm")],
      sleepSessions: [],
      game2048: createDefaultStore(),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.raw);
      expect(parsed.version).toBe(1);
      expect(parsed.alarms).toHaveLength(1);
    }
  });

  it("rejects a backup with too many alarms before it is ever written", () => {
    const alarms = Array.from({ length: 1001 }, (_, index) =>
      createAlarm(`alarm-${index}`),
    );

    expect(
      createBackupData({
        timestamp: 1,
        settings: DEFAULT_SETTINGS,
        alarms,
        sleepSessions: [],
        game2048: createDefaultStore(),
      }),
    ).toEqual({ ok: false, error: "too_many_alarms" });
  });

  it("rejects a backup with too many sleep sessions before it is ever written", () => {
    const sleepSessions = Array.from({ length: 10_001 }, (_, index) =>
      createSleepSession(`session-${index}`),
    );

    expect(
      createBackupData({
        timestamp: 1,
        settings: DEFAULT_SETTINGS,
        alarms: [],
        sleepSessions,
        game2048: createDefaultStore(),
      }),
    ).toEqual({ ok: false, error: "too_many_sleep_sessions" });
  });

  it("rejects a backup that would be too large to restore", () => {
    const oversizedAlarm = createAlarm("alarm");
    oversizedAlarm.label = "x".repeat(11 * 1024 * 1024);

    expect(
      createBackupData({
        timestamp: 1,
        settings: DEFAULT_SETTINGS,
        alarms: [oversizedAlarm],
        sleepSessions: [],
        game2048: createDefaultStore(),
      }),
    ).toEqual({ ok: false, error: "too_large" });
  });
});

describe("parseBackupDataResult", () => {
  it("distinguishes a size-limit failure from a generic version/format error", () => {
    expect(parseBackupDataResult("not json")).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(parseBackupDataResult("x".repeat(11 * 1024 * 1024))).toEqual({
      ok: false,
      error: "too_large",
    });
  });

  it("reports too_many_alarms distinctly from a generic invalid payload", () => {
    const raw = JSON.parse(createBackup([createAlarm("alarm")])) as any;
    raw.alarms = Array.from({ length: 1001 }, (_, index) =>
      createAlarm(`alarm-${index}`),
    );

    expect(parseBackupDataResult(JSON.stringify(raw))).toEqual({
      ok: false,
      error: "too_many_alarms",
    });
  });

  it("reports too_many_sleep_sessions distinctly from a generic invalid payload", () => {
    const raw = JSON.parse(createBackup([createAlarm("alarm")])) as any;
    raw.sleepSessions = Array.from({ length: 10_001 }, (_, index) =>
      createSleepSession(`session-${index}`),
    );

    expect(parseBackupDataResult(JSON.stringify(raw))).toEqual({
      ok: false,
      error: "too_many_sleep_sessions",
    });
  });

  it("returns the parsed data on success", () => {
    const result = parseBackupDataResult(createBackup([createAlarm("alarm")]));

    expect(result.ok).toBe(true);
  });
});

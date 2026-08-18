import type { Alarm } from "../../src/models/Alarm";

let mockStoredValue: string | null = null;

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(mockStoredValue)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

function makeAlarm(): Alarm {
  return {
    id: "alarm-1",
    label: "Alarm",
    enabled: true,
    targetTimestampMs: 2_000_000_000_000,
    setInTimeSystem: "24h",
    repeat: null,
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    snoozeCount: 0,
    autoSilenceMin: 10,
    soundUri: null,
    vibrationEnabled: true,
    notifeeTriggerId: null,
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    mathDifficulty: 1,
    lastFiredAt: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("alarmsAtom", () => {
  beforeEach(() => {
    mockStoredValue = null;
  });

  it("normalizes alarms loaded from storage", async () => {
    mockStoredValue = JSON.stringify([makeAlarm()]);
    jest.resetModules();
    const { createStore } = require("jotai") as typeof import("jotai");
    const { alarmsAtom } =
      require("../../src/atoms/alarmAtoms") as typeof import("../../src/atoms/alarmAtoms");

    const alarms = await createStore().get(alarmsAtom);

    expect(alarms).toEqual([
      expect.objectContaining({
        id: "alarm-1",
        recurrenceAnchorTimestampMs: null,
      }),
    ]);
  });

  it("uses an empty list for invalid persisted alarms", async () => {
    mockStoredValue = JSON.stringify([null, { id: 1 }]);
    jest.resetModules();
    const { createStore } = require("jotai") as typeof import("jotai");
    const { alarmsAtom } =
      require("../../src/atoms/alarmAtoms") as typeof import("../../src/atoms/alarmAtoms");

    await expect(createStore().get(alarmsAtom)).resolves.toEqual([]);
  });
});

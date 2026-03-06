import AsyncStorage from "@react-native-async-storage/async-storage";

import { rescheduleAllEnabledAlarms } from "../../../../src/features/alarm/services/alarmRescheduler";
import type { Alarm } from "../../../../src/models/Alarm";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue("alarm"),
    createTriggerNotification: jest.fn().mockResolvedValue("trigger-id"),
    cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    onBackgroundEvent: jest.fn(),
  },
  TriggerType: { TIMESTAMP: 0 },
  AndroidImportance: { HIGH: 4, MAX: 5 },
  AndroidCategory: { ALARM: "alarm" },
}));

jest.mock(
  "../../../../src/features/alarm/services/alarmRescheduler",
  () => ({
    rescheduleAllEnabledAlarms: jest.fn(),
  }),
);

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "test-alarm-1",
    label: "Wake up",
    enabled: true,
    targetTimestampMs: Date.now() + 3600000,
    setInTimeSystem: "custom",
    repeat: null,
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    snoozeCount: 0,
    autoSilenceMin: 15,
    soundUri: null,
    vibrationEnabled: true,
    notifeeTriggerId: null,
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    mathDifficulty: 1,
    lastFiredAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("bootRescheduleTask", () => {
  let bootRescheduleTask: () => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-import to get a fresh module each time
    bootRescheduleTask =
      require("../../../../src/features/alarm/services/bootRescheduleTask").default;
  });

  it("reads alarms from AsyncStorage and reschedules them", async () => {
    const alarms = [makeAlarm(), makeAlarm({ id: "test-alarm-2" })];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify(alarms),
    );

    await bootRescheduleTask();

    expect(AsyncStorage.getItem).toHaveBeenCalledWith("@laimelea/alarms");
    expect(rescheduleAllEnabledAlarms).toHaveBeenCalledWith(alarms);
  });

  it("does nothing when AsyncStorage has no alarms", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    await bootRescheduleTask();

    expect(AsyncStorage.getItem).toHaveBeenCalledWith("@laimelea/alarms");
    expect(rescheduleAllEnabledAlarms).not.toHaveBeenCalled();
  });

  it("silently handles JSON parse errors", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      "invalid json {{{",
    );

    await expect(bootRescheduleTask()).resolves.toBeUndefined();
    expect(rescheduleAllEnabledAlarms).not.toHaveBeenCalled();
  });

  it("silently handles AsyncStorage read errors", async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
      new Error("storage error"),
    );

    await expect(bootRescheduleTask()).resolves.toBeUndefined();
    expect(rescheduleAllEnabledAlarms).not.toHaveBeenCalled();
  });

  it("silently handles reschedule errors", async () => {
    const alarms = [makeAlarm()];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify(alarms),
    );
    (rescheduleAllEnabledAlarms as jest.Mock).mockRejectedValue(
      new Error("schedule failed"),
    );

    await expect(bootRescheduleTask()).resolves.toBeUndefined();
  });
});

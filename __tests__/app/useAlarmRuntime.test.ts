import { renderHook, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";

import {
  groupLatestAlarmDeliveries,
  useAlarmRuntime,
} from "../../src/app/useAlarmRuntime";
import { alarmsAtom } from "../../src/atoms/alarmAtoms";
import { settingsAtom } from "../../src/atoms/settingsAtoms";
import type { Alarm } from "../../src/models/Alarm";
import { DEFAULT_SETTINGS } from "../../src/models/Settings";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../../src/core/storage/asyncStorageAdapter", () => ({
  createAsyncStorage: () => {
    const storage = new Map<string, unknown>();
    return {
      getItem: (key: string, initialValue: unknown) =>
        storage.has(key) ? storage.get(key) : initialValue,
      setItem: (key: string, value: unknown) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };
  },
}));

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    cancelNotification: jest.fn(() => Promise.resolve()),
    cancelTriggerNotification: jest.fn(() => Promise.resolve()),
  },
  TriggerType: { TIMESTAMP: 0 },
}));

const mockConsumeNativeAlarmDeliveries = jest.fn();
const mockAcknowledgeNativeAlarmDeliveries = jest
  .fn()
  .mockResolvedValue(undefined);
const mockCancelAlarmAudio = jest.fn().mockResolvedValue(undefined);
const mockGetScheduledAlarmIds = jest.fn().mockResolvedValue(null);

jest.mock("../../src/features/alarm/services/ringtoneService", () => ({
  consumeNativeAlarmDeliveries: (...args: unknown[]) =>
    mockConsumeNativeAlarmDeliveries(...args),
  acknowledgeNativeAlarmDeliveries: (...args: unknown[]) =>
    mockAcknowledgeNativeAlarmDeliveries(...args),
  cancelAlarmAudio: (...args: unknown[]) => mockCancelAlarmAudio(...args),
  getScheduledAlarmIds: (...args: unknown[]) =>
    mockGetScheduledAlarmIds(...args),
}));

const mockProcessAlarmDeliveryUnqueued = jest.fn();
jest.mock("../../src/features/alarm/services/alarmDeliveryService", () => ({
  processAlarmDeliveryUnqueued: (...args: unknown[]) =>
    mockProcessAlarmDeliveryUnqueued(...args),
}));

jest.mock("../../src/features/alarm/services/alarmRescheduler", () => ({
  rescheduleAllEnabledAlarms: jest.fn(async (alarms: unknown) => alarms),
}));

const mockCompleteAlarmFiringNavigation = jest.fn();
const mockEnqueueAlarmFiringNavigation = jest.fn();
jest.mock("../../src/app/navigation", () => ({
  completeAlarmFiringNavigation: (...args: unknown[]) =>
    mockCompleteAlarmFiringNavigation(...args),
  enqueueAlarmFiringNavigation: (...args: unknown[]) =>
    mockEnqueueAlarmFiringNavigation(...args),
}));

describe("groupLatestAlarmDeliveries", () => {
  it("keeps only the latest occurrence while acknowledging the whole group", () => {
    const groups = groupLatestAlarmDeliveries([
      {
        deliveryId: "old",
        alarmId: "alarm-1",
        occurrenceTimestampMs: 1_000,
        autoSilenceMs: 60_000,
        stopped: true,
      },
      {
        deliveryId: "latest",
        alarmId: "alarm-1",
        occurrenceTimestampMs: 2_000,
        autoSilenceMs: 60_000,
        stopped: false,
      },
    ]);

    expect(groups).toEqual([
      {
        delivery: expect.objectContaining({ deliveryId: "latest" }),
        superseded: [expect.objectContaining({ deliveryId: "old" })],
        deliveryIds: ["old", "latest"],
      },
    ]);
  });

  it("prefers a stopped update for the same occurrence", () => {
    const groups = groupLatestAlarmDeliveries([
      {
        deliveryId: "fired",
        alarmId: "alarm-1",
        occurrenceTimestampMs: 1_000,
        autoSilenceMs: 0,
        stopped: false,
      },
      {
        deliveryId: "stopped",
        alarmId: "alarm-1",
        occurrenceTimestampMs: 1_000,
        autoSilenceMs: 0,
        stopped: true,
      },
    ]);

    expect(groups[0].delivery).toEqual(
      expect.objectContaining({ deliveryId: "stopped", stopped: true }),
    );
    expect(groups[0].superseded).toEqual([]);
  });

  it("surfaces every superseded stop, not just the one closest to the winner", () => {
    const groups = groupLatestAlarmDeliveries([
      {
        deliveryId: "very-old-stop",
        alarmId: "alarm-1",
        occurrenceTimestampMs: 500,
        autoSilenceMs: 0,
        stopped: true,
      },
      {
        deliveryId: "latest",
        alarmId: "alarm-1",
        occurrenceTimestampMs: 2_000,
        autoSilenceMs: 0,
        stopped: false,
      },
      {
        deliveryId: "old-stop",
        alarmId: "alarm-1",
        occurrenceTimestampMs: 1_000,
        autoSilenceMs: 0,
        stopped: true,
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].delivery).toEqual(
      expect.objectContaining({ deliveryId: "latest" }),
    );
    expect(groups[0].superseded.map((delivery) => delivery.deliveryId)).toEqual(
      ["very-old-stop", "old-stop"],
    );
    expect(groups[0].deliveryIds).toEqual([
      "very-old-stop",
      "latest",
      "old-stop",
    ]);
  });

  it("does not treat a superseded active (non-stopped) delivery as needing its own processing", () => {
    const groups = groupLatestAlarmDeliveries([
      {
        deliveryId: "stray-active",
        alarmId: "alarm-1",
        occurrenceTimestampMs: 1_000,
        autoSilenceMs: 0,
        stopped: false,
      },
      {
        deliveryId: "latest",
        alarmId: "alarm-1",
        occurrenceTimestampMs: 2_000,
        autoSilenceMs: 0,
        stopped: false,
      },
    ]);

    expect(groups[0].superseded).toEqual([]);
  });

  it("groups independently per alarmId", () => {
    const groups = groupLatestAlarmDeliveries([
      {
        deliveryId: "a1-stop",
        alarmId: "alarm-1",
        occurrenceTimestampMs: 1_000,
        autoSilenceMs: 0,
        stopped: true,
      },
      {
        deliveryId: "a1-latest",
        alarmId: "alarm-1",
        occurrenceTimestampMs: 2_000,
        autoSilenceMs: 0,
        stopped: false,
      },
      {
        deliveryId: "a2-only",
        alarmId: "alarm-2",
        occurrenceTimestampMs: 1_500,
        autoSilenceMs: 0,
        stopped: true,
      },
    ]);

    expect(groups).toHaveLength(2);
    const [first, second] = groups;
    expect(first.delivery.alarmId).toBe("alarm-2");
    expect(first.superseded).toEqual([]);
    expect(second.delivery.alarmId).toBe("alarm-1");
    expect(second.superseded.map((delivery) => delivery.deliveryId)).toEqual([
      "a1-stop",
    ]);
  });
});

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  const now = Date.now();
  return {
    id: "alarm-1",
    label: "Wake up",
    enabled: true,
    targetTimestampMs: now,
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
    activeOccurrenceTimestampMs: null,
    lastDeliveredOccurrenceTimestampMs: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("useAlarmRuntime synchronization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetScheduledAlarmIds.mockResolvedValue(null);
  });

  it("processes a superseded stop before the winning delivery, in order", async () => {
    const alarm = makeAlarm({ activeOccurrenceTimestampMs: 1_000 });
    const store = createStore();
    store.set(settingsAtom, DEFAULT_SETTINGS);
    store.set(alarmsAtom, [alarm]);

    const stoppedDelivery = {
      deliveryId: "old-stop",
      alarmId: alarm.id,
      occurrenceTimestampMs: 1_000,
      autoSilenceMs: 0,
      stopped: true,
    };
    const activeDelivery = {
      deliveryId: "new-active",
      alarmId: alarm.id,
      occurrenceTimestampMs: 2_000,
      autoSilenceMs: 0,
      stopped: false,
    };
    mockConsumeNativeAlarmDeliveries
      .mockResolvedValueOnce([stoppedDelivery, activeDelivery])
      .mockResolvedValue([]);
    mockProcessAlarmDeliveryUnqueued.mockResolvedValue({
      handled: true,
      alarms: [alarm],
      updatedAlarm: alarm,
      previousAlarm: alarm,
      rescheduleFailed: false,
    });

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(JotaiProvider, { store }, children);
    }

    renderHook(() => useAlarmRuntime(true), { wrapper: Wrapper });

    await waitFor(() => {
      expect(mockProcessAlarmDeliveryUnqueued).toHaveBeenCalledTimes(2);
    });

    expect(mockProcessAlarmDeliveryUnqueued.mock.calls[0][0]).toBe(
      stoppedDelivery,
    );
    expect(mockProcessAlarmDeliveryUnqueued.mock.calls[1][0]).toBe(
      activeDelivery,
    );
    expect(mockCompleteAlarmFiringNavigation).toHaveBeenCalledWith(alarm.id);
    expect(mockEnqueueAlarmFiringNavigation).toHaveBeenCalledWith(alarm.id);
  });
});

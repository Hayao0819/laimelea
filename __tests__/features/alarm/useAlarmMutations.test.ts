import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createStore, Provider } from "jotai";
import React, { type PropsWithChildren } from "react";

import { alarmsAtom } from "../../../src/atoms/alarmAtoms";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { useAlarmMutations } from "../../../src/features/alarm/hooks/useAlarmMutations";
import {
  AlarmMutationError,
  deleteAlarmSchedule,
  replaceAlarmSchedule,
  scheduleAlarmBatch,
  scheduleAlarmRecord,
  setAlarmEnabled,
  skipNextAlarmOccurrence,
} from "../../../src/features/alarm/services/alarmMutationService";
import { recoverAlarmSchedule } from "../../../src/features/alarm/services/alarmScheduler";
import { requestClockWidgetUpdate } from "../../../src/features/widget/services/widgetUpdater";
import type { Alarm } from "../../../src/models/Alarm";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";

const mockStorageSet = jest.fn<Promise<void>, [string, unknown]>();

jest.mock("../../../src/core/storage/asyncStorageAdapter", () => ({
  createAsyncStorage: () => ({
    getItem: jest.fn((_key: string, initialValue: unknown) => initialValue),
    setItem: (...args: [string, unknown]) => mockStorageSet(...args),
    removeItem: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock("../../../src/features/alarm/services/alarmMutationService", () => ({
  AlarmMutationError: class MockAlarmMutationError extends Error {
    recoveredAlarm?: Alarm;

    constructor(
      message: string,
      recoveredAlarm?: Alarm,
      _cause?: unknown,
      readonly retainedAlarms: Alarm[] = [],
    ) {
      super(message);
      this.recoveredAlarm = recoveredAlarm;
    }
  },
  deleteAlarmSchedule: jest.fn(),
  replaceAlarmSchedule: jest.fn(),
  scheduleAlarmBatch: jest.fn(),
  scheduleAlarmRecord: jest.fn(),
  setAlarmEnabled: jest.fn(),
  skipNextAlarmOccurrence: jest.fn(),
}));

jest.mock("../../../src/features/alarm/services/alarmScheduler", () => ({
  recoverAlarmSchedule: jest.fn(),
}));

jest.mock("../../../src/features/widget/services/widgetUpdater", () => ({
  requestClockWidgetUpdate: jest.fn(),
}));

const now = 1_800_000_000_000;

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "alarm-1",
    label: "Alarm",
    enabled: true,
    targetTimestampMs: now + 60_000,
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function renderMutations(initialAlarms: Alarm[] = []) {
  const store = createStore();
  await store.set(settingsAtom, DEFAULT_SETTINGS);
  const wrapper = ({ children }: PropsWithChildren) =>
    React.createElement(Provider, { store }, children);
  const hook = renderHook(() => useAlarmMutations(), { wrapper });
  await act(async () => {
    await store.set(alarmsAtom, initialAlarms);
  });
  return { ...hook, store };
}

describe("useAlarmMutations persistence compensation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageSet.mockResolvedValue(undefined);
    (deleteAlarmSchedule as jest.Mock).mockResolvedValue(undefined);
  });

  it("cancels a newly scheduled alarm when persistence fails", async () => {
    const alarm = makeAlarm();
    const scheduled = { ...alarm, notifeeTriggerId: "native-trigger" };
    (scheduleAlarmRecord as jest.Mock).mockResolvedValue(scheduled);
    const { result, store } = await renderMutations();
    mockStorageSet.mockRejectedValueOnce(new Error("storage failed"));

    await act(async () => {
      await expect(result.current.createAlarm(alarm)).rejects.toThrow(
        "storage failed",
      );
    });

    expect(deleteAlarmSchedule).toHaveBeenCalledWith(
      scheduled,
      DEFAULT_SETTINGS.cycleConfig,
    );
    expect(await Promise.resolve(store.get(alarmsAtom))).toEqual([]);
  });

  it("restores the prior native schedule when replacement persistence fails", async () => {
    const previous = makeAlarm({ notifeeTriggerId: "old-trigger" });
    const next = makeAlarm({ label: "Updated", updatedAt: now + 1 });
    const scheduled = { ...next, notifeeTriggerId: "new-trigger" };
    const restored = { ...previous, notifeeTriggerId: "restored-trigger" };
    (replaceAlarmSchedule as jest.Mock)
      .mockResolvedValueOnce(scheduled)
      .mockResolvedValueOnce(restored);
    const { result, store } = await renderMutations([previous]);
    mockStorageSet.mockRejectedValueOnce(new Error("storage failed"));

    await act(async () => {
      await expect(result.current.replaceAlarm(previous, next)).rejects.toThrow(
        "storage failed",
      );
    });

    expect(replaceAlarmSchedule).toHaveBeenNthCalledWith(
      2,
      scheduled,
      previous,
      DEFAULT_SETTINGS.cycleConfig,
    );
    expect(await Promise.resolve(store.get(alarmsAtom))).toEqual([restored]);
  });

  it("does not overwrite a concurrent edit with the same timestamp", async () => {
    const previous = makeAlarm({ notifeeTriggerId: "old-trigger" });
    const next = makeAlarm({ label: "Updated", updatedAt: now + 1 });
    const scheduled = { ...next, notifeeTriggerId: "new-trigger" };
    const restored = { ...previous, notifeeTriggerId: "restored-trigger" };
    const concurrent = { ...scheduled, label: "Newer edit" };
    let rejectStorage: ((error: Error) => void) | undefined;
    (replaceAlarmSchedule as jest.Mock)
      .mockResolvedValueOnce(scheduled)
      .mockResolvedValueOnce(restored);
    const { result, store } = await renderMutations([previous]);
    mockStorageSet.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectStorage = reject;
        }),
    );

    const replacement = result.current.replaceAlarm(previous, next);
    replacement.catch(() => undefined);
    await waitFor(() => expect(mockStorageSet).toHaveBeenCalled());
    await act(async () => {
      await store.set(alarmsAtom, [concurrent]);
    });
    await act(async () => {
      rejectStorage?.(new Error("storage failed"));
      await expect(replacement).rejects.toThrow("storage failed");
    });

    expect(await Promise.resolve(store.get(alarmsAtom))).toEqual([concurrent]);
  });

  it("persists enabled-state and skipped-occurrence updates before refreshing widgets", async () => {
    const alarm = makeAlarm({ notifeeTriggerId: "old-trigger" });
    const disabled = {
      ...alarm,
      enabled: false,
      notifeeTriggerId: null,
      updatedAt: now + 1,
    };
    const skipped = {
      ...disabled,
      enabled: true,
      skipNextOccurrence: true,
      notifeeTriggerId: "skipped-trigger",
      updatedAt: now + 2,
    };
    (setAlarmEnabled as jest.Mock).mockResolvedValue(disabled);
    (skipNextAlarmOccurrence as jest.Mock).mockResolvedValue(skipped);
    const { result, store } = await renderMutations([alarm]);

    await act(async () => {
      await result.current.setAlarmEnabled(alarm, false);
      await result.current.skipNextAlarm(disabled);
    });

    expect(await Promise.resolve(store.get(alarmsAtom))).toEqual([skipped]);
    expect(requestClockWidgetUpdate).toHaveBeenCalledTimes(2);
  });

  it("removes a scheduled alarm and refreshes widgets", async () => {
    const alarm = makeAlarm({ notifeeTriggerId: "scheduled-trigger" });
    const { result, store } = await renderMutations([alarm]);

    await act(async () => {
      await result.current.deleteAlarm(alarm);
    });

    expect(deleteAlarmSchedule).toHaveBeenCalledWith(
      alarm,
      DEFAULT_SETTINGS.cycleConfig,
    );
    expect(await Promise.resolve(store.get(alarmsAtom))).toEqual([]);
    expect(requestClockWidgetUpdate).toHaveBeenCalledTimes(1);
  });

  it("stores every alarm returned from a successful batch schedule", async () => {
    const first = makeAlarm({ id: "alarm-1" });
    const second = makeAlarm({ id: "alarm-2", label: "Second" });
    const scheduled = [
      { ...first, notifeeTriggerId: "trigger-1" },
      { ...second, notifeeTriggerId: "trigger-2" },
    ];
    (scheduleAlarmBatch as jest.Mock).mockResolvedValue(scheduled);
    const { result, store } = await renderMutations();

    await act(async () => {
      await expect(
        result.current.createAlarms([first, second]),
      ).resolves.toEqual(scheduled);
    });

    expect(await Promise.resolve(store.get(alarmsAtom))).toEqual(scheduled);
    expect(requestClockWidgetUpdate).toHaveBeenCalledTimes(1);
  });

  it("stores a recovered alarm when the native enabled-state mutation fails", async () => {
    const alarm = makeAlarm({ notifeeTriggerId: "old-trigger" });
    const recovered = {
      ...alarm,
      notifeeTriggerId: "recovered-trigger",
      updatedAt: now + 1,
    };
    (setAlarmEnabled as jest.Mock).mockRejectedValue(
      new AlarmMutationError("cancel-failed", recovered),
    );
    const { result, store } = await renderMutations([alarm]);

    await act(async () => {
      await expect(
        result.current.setAlarmEnabled(alarm, false),
      ).rejects.toThrow("cancel-failed");
    });

    expect(await Promise.resolve(store.get(alarmsAtom))).toEqual([recovered]);
  });

  it("keeps the stored alarm when a native enabled-state mutation has no recovery", async () => {
    const alarm = makeAlarm({ notifeeTriggerId: "old-trigger" });
    (setAlarmEnabled as jest.Mock).mockRejectedValue(
      new Error("native unavailable"),
    );
    const { result, store } = await renderMutations([alarm]);

    await act(async () => {
      await expect(
        result.current.setAlarmEnabled(alarm, false),
      ).rejects.toThrow("native unavailable");
    });

    expect(await Promise.resolve(store.get(alarmsAtom))).toEqual([alarm]);
  });

  it("retains native schedules that cannot be rolled back from a failed batch", async () => {
    const retained = makeAlarm({
      id: "retained-alarm",
      notifeeTriggerId: "retained-trigger",
    });
    (scheduleAlarmBatch as jest.Mock).mockRejectedValue(
      new AlarmMutationError("schedule-failed", undefined, undefined, [
        retained,
      ]),
    );
    const { result, store } = await renderMutations();

    await act(async () => {
      await expect(result.current.createAlarms([retained])).rejects.toThrow(
        "schedule-failed",
      );
    });

    expect(await Promise.resolve(store.get(alarmsAtom))).toEqual([retained]);
    expect(requestClockWidgetUpdate).toHaveBeenCalledTimes(1);
  });

  it("restores the prior native schedule when a skipped occurrence cannot persist", async () => {
    const alarm = makeAlarm({ notifeeTriggerId: "old-trigger" });
    const skipped = {
      ...alarm,
      skipNextOccurrence: true,
      notifeeTriggerId: "skipped-trigger",
      updatedAt: now + 1,
    };
    const restored = {
      ...alarm,
      notifeeTriggerId: "restored-trigger",
      updatedAt: now + 2,
    };
    (skipNextAlarmOccurrence as jest.Mock).mockResolvedValue(skipped);
    (replaceAlarmSchedule as jest.Mock).mockResolvedValue(restored);
    const { result, store } = await renderMutations([alarm]);
    mockStorageSet.mockRejectedValueOnce(new Error("storage failed"));

    await act(async () => {
      await expect(result.current.skipNextAlarm(alarm)).rejects.toThrow(
        "storage failed",
      );
    });

    expect(replaceAlarmSchedule).toHaveBeenCalledWith(
      skipped,
      alarm,
      DEFAULT_SETTINGS.cycleConfig,
    );
    expect(await Promise.resolve(store.get(alarmsAtom))).toEqual([restored]);
  });

  it("recovers a deleted alarm when removing it cannot persist", async () => {
    const alarm = makeAlarm({ notifeeTriggerId: "old-trigger" });
    const recovered = {
      ...alarm,
      notifeeTriggerId: "recovered-trigger",
      updatedAt: now + 1,
    };
    (recoverAlarmSchedule as jest.Mock).mockResolvedValue(recovered);
    const { result, store } = await renderMutations([alarm]);
    mockStorageSet.mockRejectedValueOnce(new Error("storage failed"));

    await act(async () => {
      await expect(result.current.deleteAlarm(alarm)).rejects.toThrow(
        "storage failed",
      );
    });

    expect(recoverAlarmSchedule).toHaveBeenCalledWith(
      alarm,
      expect.any(Number),
      DEFAULT_SETTINGS.cycleConfig,
    );
    expect(await Promise.resolve(store.get(alarmsAtom))).toEqual([recovered]);
  });

  it("surfaces a failed repair alongside the original persistence error", async () => {
    const alarm = makeAlarm({ notifeeTriggerId: "old-trigger" });
    const repairError = new Error("recovery failed");
    (recoverAlarmSchedule as jest.Mock).mockRejectedValue(repairError);
    const { result, store } = await renderMutations([alarm]);
    mockStorageSet.mockRejectedValueOnce(new Error("storage failed"));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.deleteAlarm(alarm);
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("storage failed");
    expect((caught as Error & { recoveryError?: unknown }).recoveryError).toBe(
      repairError,
    );
    expect(await Promise.resolve(store.get(alarmsAtom))).toEqual([alarm]);
  });

  it("rolls back every scheduled trigger when persisting a batch fails", async () => {
    const first = makeAlarm({ id: "alarm-1" });
    const second = makeAlarm({ id: "alarm-2", label: "Second" });
    const scheduled = [
      { ...first, notifeeTriggerId: "trigger-1" },
      { ...second, notifeeTriggerId: "trigger-2" },
    ];
    (scheduleAlarmBatch as jest.Mock).mockResolvedValue(scheduled);
    const { result, store } = await renderMutations();
    mockStorageSet.mockRejectedValueOnce(new Error("storage failed"));

    await act(async () => {
      await expect(
        result.current.createAlarms([first, second]),
      ).rejects.toThrow("storage failed");
    });

    expect(deleteAlarmSchedule).toHaveBeenCalledTimes(2);
    expect(deleteAlarmSchedule).toHaveBeenCalledWith(
      scheduled[0],
      DEFAULT_SETTINGS.cycleConfig,
    );
    expect(deleteAlarmSchedule).toHaveBeenCalledWith(
      scheduled[1],
      DEFAULT_SETTINGS.cycleConfig,
    );
    expect(await Promise.resolve(store.get(alarmsAtom))).toEqual([]);
  });
});

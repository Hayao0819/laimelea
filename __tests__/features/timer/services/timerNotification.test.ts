import notifee from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDefaultStore } from "jotai";
import { NativeModules, Platform } from "react-native";

import { timersAtom } from "../../../../src/atoms/timerAtoms";
import { getAlarmDeliveryStatus } from "../../../../src/core/notifications/notifeeSetup";
import { STORAGE_KEYS } from "../../../../src/core/storage/keys";
import {
  ANDROID_TIMER_TRIGGER_LIMIT,
  cancelTimerTrigger,
  completeTimerFromNotification,
  consumeCompletedTimerIds,
  scheduleTimerTrigger,
  showTimerCompleteNotification,
  TimerNotificationsDisabledError,
  TimerTriggerLimitError,
} from "../../../../src/features/timer/services/timerNotification";

jest.mock("../../../../src/core/notifications/notifeeSetup", () => ({
  getAlarmDeliveryStatus: jest.fn(),
  TIMER_CHANNEL_ID: "timer",
}));

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    displayNotification: jest.fn().mockResolvedValue(undefined),
    createChannel: jest.fn().mockResolvedValue("timer"),
    createTriggerNotification: jest.fn().mockResolvedValue("trigger-id"),
    cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
  },
  AndroidImportance: { DEFAULT: 3 },
  TriggerType: { TIMESTAMP: 0 },
}));

const storage: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(storage[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      storage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete storage[key];
      return Promise.resolve();
    }),
  },
}));

describe("showTimerCompleteNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAlarmDeliveryStatus).mockResolvedValue({
      notificationsEnabled: true,
      exactAlarmsEnabled: true,
      fullScreenIntentEnabled: true,
    });
    (notifee.getTriggerNotificationIds as jest.Mock).mockResolvedValue([]);
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
    for (const key of Object.keys(storage)) delete storage[key];
    delete (NativeModules as { RingtoneModule?: unknown }).RingtoneModule;
  });

  it("should display notification with given label", async () => {
    await showTimerCompleteNotification("My Timer");

    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "My Timer",
        body: "Timer complete",
      }),
    );
  });

  it("should use 'Timer' as title when label is empty", async () => {
    await showTimerCompleteNotification("");

    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Timer",
      }),
    );
  });

  it("should use timer channel", async () => {
    await showTimerCompleteNotification("Test");

    const call = (notifee.displayNotification as jest.Mock).mock.calls[0][0];
    expect(call.android.channelId).toBe("timer");
  });

  it("should set autoCancel to true", async () => {
    await showTimerCompleteNotification("Test");

    const call = (notifee.displayNotification as jest.Mock).mock.calls[0][0];
    expect(call.android.autoCancel).toBe(true);
  });

  it("should set sound and vibration", async () => {
    await showTimerCompleteNotification("Test");

    const call = (notifee.displayNotification as jest.Mock).mock.calls[0][0];
    expect(call.android.sound).toBe("default");
    expect(call.android.vibrationPattern).toEqual([300, 500]);
  });

  it("uses an audible foreground presentation on iOS", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });

    await showTimerCompleteNotification("Test");

    const call = (notifee.displayNotification as jest.Mock).mock.calls[0][0];
    expect(call.android).toBeUndefined();
    expect(call.ios).toEqual(
      expect.objectContaining({
        sound: "default",
        foregroundPresentationOptions: expect.objectContaining({ sound: true }),
      }),
    );
  });
});

describe("scheduleTimerTrigger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAlarmDeliveryStatus).mockResolvedValue({
      notificationsEnabled: true,
      exactAlarmsEnabled: true,
      fullScreenIntentEnabled: true,
    });
    (notifee.getTriggerNotificationIds as jest.Mock).mockResolvedValue([]);
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
    jest.spyOn(Date, "now").mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (NativeModules as { RingtoneModule?: unknown }).RingtoneModule;
  });

  it("should schedule a trigger notification with correct timestamp", async () => {
    await scheduleTimerTrigger({
      id: "timer-1",
      label: "My Timer",
      durationMs: 10000,
      startedAt: 1000,
      pausedElapsedMs: 0,
    });

    expect(notifee.createTriggerNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "timer-timer-1",
        data: { timerId: "timer-1" },
        title: "My Timer",
        body: "Timer complete",
      }),
      expect.objectContaining({
        type: 0,
        timestamp: 11000,
        alarmManager: { allowWhileIdle: true },
      }),
    );
  });

  it("uses Android elapsed-time scheduling when the native module is available", async () => {
    const scheduleTimer = jest.fn().mockResolvedValue(undefined);
    (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
      scheduleTimer,
      cancelTimer: jest.fn(),
      consumeCompletedTimers: jest.fn(),
    };

    await scheduleTimerTrigger({
      id: "elapsed-timer",
      label: "Elapsed",
      durationMs: 10_000,
      startedAt: -100_000,
      pausedElapsedMs: 2_000,
    });

    expect(scheduleTimer).toHaveBeenCalledWith(
      "elapsed-timer",
      "Elapsed",
      8_000,
    );
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it("schedules native Android delivery even when notifications are disabled", async () => {
    const scheduleTimer = jest.fn().mockResolvedValue(undefined);
    (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
      scheduleTimer,
      cancelTimer: jest.fn(),
      consumeCompletedTimers: jest.fn(),
    };
    jest.mocked(getAlarmDeliveryStatus).mockResolvedValue({
      notificationsEnabled: false,
      exactAlarmsEnabled: true,
      fullScreenIntentEnabled: true,
    });

    await scheduleTimerTrigger({
      id: "disabled-notifications",
      label: "Timer",
      durationMs: 10_000,
      startedAt: 1_000,
      pausedElapsedMs: 0,
    });

    expect(scheduleTimer).toHaveBeenCalledWith(
      "disabled-notifications",
      "Timer",
      10_000,
    );
    expect(getAlarmDeliveryStatus).not.toHaveBeenCalled();
  });

  it("rejects the notification fallback when notifications are disabled", async () => {
    jest.mocked(getAlarmDeliveryStatus).mockResolvedValue({
      notificationsEnabled: false,
      exactAlarmsEnabled: true,
      fullScreenIntentEnabled: true,
    });

    await expect(
      scheduleTimerTrigger({
        id: "disabled-notifications-fallback",
        label: "Timer",
        durationMs: 10_000,
        startedAt: 1_000,
        pausedElapsedMs: 0,
      }),
    ).rejects.toBeInstanceOf(TimerNotificationsDisabledError);
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it("includes completions recorded by native timer delivery", async () => {
    (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
      scheduleTimer: jest.fn(),
      cancelTimer: jest.fn(),
      consumeCompletedTimers: jest.fn().mockResolvedValue(["native-timer"]),
    };

    await expect(consumeCompletedTimerIds()).resolves.toEqual(["native-timer"]);
  });

  it("should account for pausedElapsedMs in completion time", async () => {
    await scheduleTimerTrigger({
      id: "timer-2",
      label: "Paused Timer",
      durationMs: 10000,
      startedAt: 5000,
      pausedElapsedMs: 3000,
    });

    expect(notifee.createTriggerNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        timestamp: 12000,
      }),
    );
  });

  it("should not schedule trigger if completion time is in the past", async () => {
    jest.spyOn(Date, "now").mockReturnValue(20000);

    await scheduleTimerTrigger({
      id: "timer-3",
      label: "Expired",
      durationMs: 5000,
      startedAt: 1000,
      pausedElapsedMs: 0,
    });

    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it("should use 'Timer' as title when label is empty", async () => {
    await scheduleTimerTrigger({
      id: "timer-4",
      label: "",
      durationMs: 10000,
      startedAt: 1000,
      pausedElapsedMs: 0,
    });

    expect(notifee.createTriggerNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Timer",
      }),
      expect.anything(),
    );
  });

  it("should include pressAction and autoCancel in android config", async () => {
    await scheduleTimerTrigger({
      id: "timer-5",
      label: "Test",
      durationMs: 10000,
      startedAt: 1000,
      pausedElapsedMs: 0,
    });

    const call = (notifee.createTriggerNotification as jest.Mock).mock
      .calls[0][0];
    expect(call.android.pressAction).toEqual({ id: "default" });
    expect(call.android.autoCancel).toBe(true);
    expect(call.android.channelId).toBe("timer");
  });

  it("uses an audible foreground presentation on iOS", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });

    await scheduleTimerTrigger({
      id: "timer-ios",
      label: "Timer",
      durationMs: 10000,
      startedAt: 1000,
      pausedElapsedMs: 0,
    });

    const call = (notifee.createTriggerNotification as jest.Mock).mock
      .calls[0][0];
    expect(call.android).toBeUndefined();
    expect(call.ios).toEqual(
      expect.objectContaining({
        sound: "default",
        foregroundPresentationOptions: expect.objectContaining({ sound: true }),
      }),
    );
  });

  it("rejects when scheduling fails", async () => {
    (notifee.createTriggerNotification as jest.Mock).mockRejectedValueOnce(
      new Error("Schedule failed"),
    );

    await expect(
      scheduleTimerTrigger({
        id: "timer-6",
        label: "Failing",
        durationMs: 10000,
        startedAt: 1000,
        pausedElapsedMs: 0,
      }),
    ).rejects.toThrow("Schedule failed");
  });

  it("rejects before creating a new Android trigger at the system limit", async () => {
    (notifee.getTriggerNotificationIds as jest.Mock).mockResolvedValue(
      Array.from(
        { length: ANDROID_TIMER_TRIGGER_LIMIT },
        (_, index) => `trigger-${index}`,
      ),
    );

    await expect(
      scheduleTimerTrigger({
        id: "timer-over-limit",
        label: "Over limit",
        durationMs: 10000,
        startedAt: 1000,
        pausedElapsedMs: 0,
      }),
    ).rejects.toBeInstanceOf(TimerTriggerLimitError);
    expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  it("updates an existing trigger even when Android is at its limit", async () => {
    (notifee.getTriggerNotificationIds as jest.Mock).mockResolvedValue(
      Array.from({ length: ANDROID_TIMER_TRIGGER_LIMIT }, (_, index) =>
        index === 0 ? "timer-timer-6" : `trigger-${index}`,
      ),
    );

    await scheduleTimerTrigger({
      id: "timer-6",
      label: "Existing",
      durationMs: 10000,
      startedAt: 1000,
      pausedElapsedMs: 0,
    });

    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1);
  });

  it("serializes the limit check across concurrent timer registrations", async () => {
    const ids = Array.from(
      { length: ANDROID_TIMER_TRIGGER_LIMIT - 1 },
      (_, index) => `trigger-${index}`,
    );
    (notifee.getTriggerNotificationIds as jest.Mock)
      .mockResolvedValueOnce(ids)
      .mockResolvedValueOnce([...ids, "timer-first"]);
    let finishFirst: (() => void) | undefined;
    (notifee.createTriggerNotification as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishFirst = () => resolve("timer-first");
        }),
    );

    const first = scheduleTimerTrigger({
      id: "first",
      label: "First",
      durationMs: 10000,
      startedAt: 1000,
      pausedElapsedMs: 0,
    });
    const second = scheduleTimerTrigger({
      id: "second",
      label: "Second",
      durationMs: 10000,
      startedAt: 1000,
      pausedElapsedMs: 0,
    });

    for (let index = 0; index < 8 && finishFirst === undefined; index++) {
      await Promise.resolve();
    }
    expect(notifee.getTriggerNotificationIds).toHaveBeenCalledTimes(1);

    finishFirst?.();
    await first;
    await expect(second).rejects.toBeInstanceOf(TimerTriggerLimitError);
    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1);
  });
});

describe("consumeCompletedTimerIds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(storage)) delete storage[key];
    delete (NativeModules as { RingtoneModule?: unknown }).RingtoneModule;
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
  });

  afterEach(() => {
    delete (NativeModules as { RingtoneModule?: unknown }).RingtoneModule;
  });

  it("dedups native-completed ids with ids persisted by background delivery", async () => {
    (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
      scheduleTimer: jest.fn(),
      cancelTimer: jest.fn(),
      consumeCompletedTimers: jest
        .fn()
        .mockResolvedValue(["timer-a", "timer-b"]),
    };
    storage[STORAGE_KEYS.TIMER_COMPLETIONS] = JSON.stringify([
      "timer-b",
      "timer-c",
    ]);

    await expect(consumeCompletedTimerIds()).resolves.toEqual([
      "timer-a",
      "timer-b",
      "timer-c",
    ]);
    expect(storage[STORAGE_KEYS.TIMER_COMPLETIONS]).toBeUndefined();
  });

  it("falls back to native ids when the persisted completions are corrupted JSON", async () => {
    (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
      scheduleTimer: jest.fn(),
      cancelTimer: jest.fn(),
      consumeCompletedTimers: jest.fn().mockResolvedValue(["timer-a"]),
    };
    storage[STORAGE_KEYS.TIMER_COMPLETIONS] = "{not-json";

    await expect(consumeCompletedTimerIds()).resolves.toEqual(["timer-a"]);
  });
});

describe("completeTimerFromNotification", () => {
  const store = getDefaultStore();

  beforeEach(async () => {
    jest.clearAllMocks();
    for (const key of Object.keys(storage)) delete storage[key];
    await store.set(timersAtom, []);
    jest.clearAllMocks();
  });

  it("completes only the delivered timer in persisted state", async () => {
    await store.set(timersAtom, [
      {
        id: "timer-1",
        label: "First",
        durationMs: 1000,
        remainingMs: 200,
        isRunning: true,
        startedAt: 10,
        pausedElapsedMs: 0,
      },
      {
        id: "timer-2",
        label: "Second",
        durationMs: 1000,
        remainingMs: 500,
        isRunning: true,
        startedAt: 20,
        pausedElapsedMs: 0,
      },
    ]);

    await completeTimerFromNotification("timer-1");

    expect(store.get(timersAtom)).toEqual([
      expect.objectContaining({
        id: "timer-1",
        remainingMs: 0,
        isRunning: false,
        startedAt: null,
      }),
      expect.objectContaining({ id: "timer-2", remainingMs: 500 }),
    ]);
    expect(JSON.parse(storage[STORAGE_KEYS.TIMER_STATE])).toEqual(
      store.get(timersAtom),
    );
    expect(JSON.parse(storage[STORAGE_KEYS.TIMER_COMPLETIONS])).toEqual([
      "timer-1",
    ]);
  });

  it("serializes simultaneous timer completions", async () => {
    await store.set(timersAtom, [
      {
        id: "timer-1",
        label: "First",
        durationMs: 1000,
        remainingMs: 200,
        isRunning: true,
        startedAt: 10,
        pausedElapsedMs: 0,
      },
      {
        id: "timer-2",
        label: "Second",
        durationMs: 1000,
        remainingMs: 500,
        isRunning: true,
        startedAt: 20,
        pausedElapsedMs: 0,
      },
    ]);

    await Promise.all([
      completeTimerFromNotification("timer-1"),
      completeTimerFromNotification("timer-2"),
    ]);

    expect(store.get(timersAtom)).toEqual([
      expect.objectContaining({ id: "timer-1", isRunning: false }),
      expect.objectContaining({ id: "timer-2", isRunning: false }),
    ]);
    expect(JSON.parse(storage[STORAGE_KEYS.TIMER_COMPLETIONS])).toEqual([
      "timer-1",
      "timer-2",
    ]);
  });

  it("is idempotent after a timer has already been completed", async () => {
    await store.set(timersAtom, [
      {
        id: "timer-1",
        label: "First",
        durationMs: 1000,
        remainingMs: 0,
        isRunning: false,
        startedAt: null,
        pausedElapsedMs: 0,
      },
    ]);
    jest.clearAllMocks();

    await completeTimerFromNotification("timer-1");

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("does not resurrect a timer deleted concurrently by the UI", async () => {
    await store.set(timersAtom, [
      {
        id: "timer-1",
        label: "First",
        durationMs: 1000,
        remainingMs: 200,
        isRunning: true,
        startedAt: 10,
        pausedElapsedMs: 0,
      },
    ]);

    await Promise.all([
      completeTimerFromNotification("timer-1"),
      store.set(timersAtom, (timers) =>
        timers.filter((timer) => timer.id !== "timer-1"),
      ),
    ]);

    expect(store.get(timersAtom)).toEqual([]);
    expect(JSON.parse(storage[STORAGE_KEYS.TIMER_STATE])).toEqual([]);
  });
});

describe("cancelTimerTrigger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (notifee.getTriggerNotificationIds as jest.Mock).mockResolvedValue([]);
  });

  it("should cancel trigger notification with prefixed id", async () => {
    await cancelTimerTrigger("timer-1");

    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(
      "timer-timer-1",
    );
    expect(notifee.cancelNotification).toHaveBeenCalledWith("timer-timer-1");
  });

  it("rejects when cancellation fails", async () => {
    (notifee.cancelTriggerNotification as jest.Mock).mockRejectedValueOnce(
      new Error("Cancel failed"),
    );

    await expect(cancelTimerTrigger("timer-2")).rejects.toThrow(
      "Cancel failed",
    );
  });

  it("waits for an in-flight schedule before cancelling the same timer", async () => {
    let finishSchedule: (() => void) | undefined;
    (notifee.createTriggerNotification as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishSchedule = () => resolve("trigger-id");
        }),
    );

    const schedule = scheduleTimerTrigger({
      id: "racing-timer",
      label: "Racing timer",
      durationMs: 10_000,
      startedAt: Date.now(),
      pausedElapsedMs: 0,
    });
    const cancel = cancelTimerTrigger("racing-timer");

    expect(notifee.cancelTriggerNotification).not.toHaveBeenCalled();
    for (let index = 0; index < 8 && finishSchedule === undefined; index++) {
      await Promise.resolve();
    }
    finishSchedule?.();
    await Promise.all([schedule, cancel]);

    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(
      "timer-racing-timer",
    );
    expect(
      (notifee.cancelTriggerNotification as jest.Mock).mock
        .invocationCallOrder[0],
    ).toBeGreaterThan(
      (notifee.createTriggerNotification as jest.Mock).mock
        .invocationCallOrder[0],
    );
  });
});

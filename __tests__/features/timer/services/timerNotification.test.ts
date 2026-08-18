import notifee from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { STORAGE_KEYS } from "../../../../src/core/storage/keys";
import {
  cancelTimerTrigger,
  completeTimerFromNotification,
  scheduleTimerTrigger,
  showTimerCompleteNotification,
} from "../../../../src/features/timer/services/timerNotification";

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    displayNotification: jest.fn().mockResolvedValue(undefined),
    createChannel: jest.fn().mockResolvedValue("timer"),
    createTriggerNotification: jest.fn().mockResolvedValue("trigger-id"),
    cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
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
  },
}));

describe("showTimerCompleteNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
    for (const key of Object.keys(storage)) delete storage[key];
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
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
    jest.spyOn(Date, "now").mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
        type: 0, // TriggerType.TIMESTAMP
        timestamp: 11000, // 1000 + 10000 - 0
        alarmManager: { allowWhileIdle: true },
      }),
    );
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
        timestamp: 12000, // 5000 + 10000 - 3000
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

  it("should catch and warn on scheduling failure", async () => {
    (notifee.createTriggerNotification as jest.Mock).mockRejectedValueOnce(
      new Error("Schedule failed"),
    );
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();

    await scheduleTimerTrigger({
      id: "timer-6",
      label: "Failing",
      durationMs: 10000,
      startedAt: 1000,
      pausedElapsedMs: 0,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to schedule timer trigger:",
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });
});

describe("completeTimerFromNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(storage)) delete storage[key];
  });

  it("completes only the delivered timer in persisted state", async () => {
    storage[STORAGE_KEYS.TIMER_STATE] = JSON.stringify([
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

    expect(JSON.parse(storage[STORAGE_KEYS.TIMER_STATE])).toEqual([
      expect.objectContaining({
        id: "timer-1",
        remainingMs: 0,
        isRunning: false,
        startedAt: null,
      }),
      expect.objectContaining({ id: "timer-2", remainingMs: 500 }),
    ]);
    expect(JSON.parse(storage[STORAGE_KEYS.TIMER_COMPLETIONS])).toEqual([
      "timer-1",
    ]);
  });

  it("serializes simultaneous timer completions", async () => {
    storage[STORAGE_KEYS.TIMER_STATE] = JSON.stringify([
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

    expect(JSON.parse(storage[STORAGE_KEYS.TIMER_STATE])).toEqual([
      expect.objectContaining({ id: "timer-1", isRunning: false }),
      expect.objectContaining({ id: "timer-2", isRunning: false }),
    ]);
    expect(JSON.parse(storage[STORAGE_KEYS.TIMER_COMPLETIONS])).toEqual([
      "timer-1",
      "timer-2",
    ]);
  });

  it("is idempotent after a timer has already been completed", async () => {
    storage[STORAGE_KEYS.TIMER_STATE] = JSON.stringify([
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

    await completeTimerFromNotification("timer-1");

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("ignores corrupted timer state without rejecting the background handler", async () => {
    storage[STORAGE_KEYS.TIMER_STATE] = "not-json";

    await expect(
      completeTimerFromNotification("timer-1"),
    ).resolves.toBeUndefined();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe("cancelTimerTrigger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should cancel trigger notification with prefixed id", async () => {
    await cancelTimerTrigger("timer-1");

    expect(notifee.cancelTriggerNotification).toHaveBeenCalledWith(
      "timer-timer-1",
    );
  });

  it("should catch and warn on cancellation failure", async () => {
    (notifee.cancelTriggerNotification as jest.Mock).mockRejectedValueOnce(
      new Error("Cancel failed"),
    );
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();

    await cancelTimerTrigger("timer-2");

    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to cancel timer trigger:",
      expect.any(Error),
    );
    warnSpy.mockRestore();
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

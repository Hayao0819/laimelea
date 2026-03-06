import notifee from "@notifee/react-native";

import {
  cancelTimerTrigger,
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

describe("showTimerCompleteNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});

describe("scheduleTimerTrigger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});


import notifee from "@notifee/react-native";

import { showTimerCompleteNotification } from "../../../../src/features/timer/services/timerNotification";

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    displayNotification: jest.fn().mockResolvedValue(undefined),
    createChannel: jest.fn().mockResolvedValue("timer"),
  },
  AndroidImportance: { DEFAULT: 3 },
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

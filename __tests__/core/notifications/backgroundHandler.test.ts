import notifee from "@notifee/react-native";

let registeredHandler: (event: {
  type: number;
  detail: {
    notification?: { id?: string; data?: Record<string, string | undefined> };
  };
}) => Promise<void>;

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    onBackgroundEvent: jest.fn((handler) => {
      registeredHandler = handler;
    }),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
  },
  EventType: { PRESS: 1, ACTION_PRESS: 7, DISMISSED: 2 },
}));

// Import triggers the module-level onBackgroundEvent registration
require("../../../src/core/notifications/backgroundHandler");

describe("backgroundHandler", () => {
  beforeEach(() => {
    (notifee.cancelNotification as jest.Mock).mockClear();
  });

  it("should register a background event handler", () => {
    expect(notifee.onBackgroundEvent).toHaveBeenCalledTimes(1);
    expect(registeredHandler).toBeDefined();
  });

  it("should cancel non-alarm notification on PRESS event", async () => {
    await registeredHandler({
      type: 1, // PRESS
      detail: { notification: { id: "timer-notif-1" } },
    });

    expect(notifee.cancelNotification).toHaveBeenCalledWith("timer-notif-1");
  });

  it("should cancel non-alarm notification on ACTION_PRESS event", async () => {
    await registeredHandler({
      type: 7, // ACTION_PRESS
      detail: { notification: { id: "timer-notif-2" } },
    });

    expect(notifee.cancelNotification).toHaveBeenCalledWith("timer-notif-2");
  });

  it("should NOT cancel alarm notification on PRESS event", async () => {
    await registeredHandler({
      type: 1, // PRESS
      detail: {
        notification: {
          id: "alarm-uuid-1",
          data: { alarmId: "alarm-uuid-1" },
        },
      },
    });

    expect(notifee.cancelNotification).not.toHaveBeenCalled();
  });

  it("should NOT cancel alarm notification on ACTION_PRESS event", async () => {
    await registeredHandler({
      type: 7, // ACTION_PRESS
      detail: {
        notification: {
          id: "alarm-uuid-2",
          data: { alarmId: "alarm-uuid-2" },
        },
      },
    });

    expect(notifee.cancelNotification).not.toHaveBeenCalled();
  });

  it("should NOT cancel notification on DISMISSED event", async () => {
    await registeredHandler({
      type: 2, // DISMISSED
      detail: { notification: { id: "notif-3" } },
    });

    expect(notifee.cancelNotification).not.toHaveBeenCalled();
  });

  it("should handle PRESS event without notification id", async () => {
    await registeredHandler({
      type: 1, // PRESS
      detail: { notification: {} },
    });

    expect(notifee.cancelNotification).not.toHaveBeenCalled();
  });

  it("should handle PRESS event without notification", async () => {
    await registeredHandler({
      type: 1, // PRESS
      detail: {},
    });

    expect(notifee.cancelNotification).not.toHaveBeenCalled();
  });

  it("should cancel notification with empty data (no alarmId)", async () => {
    await registeredHandler({
      type: 1, // PRESS
      detail: { notification: { id: "notif-4", data: {} } },
    });

    expect(notifee.cancelNotification).toHaveBeenCalledWith("notif-4");
  });

  it("should cancel notification when alarmId is not a string", async () => {
    await registeredHandler({
      type: 1, // PRESS
      detail: {
        notification: {
          id: "notif-5",
          data: { alarmId: undefined },
        },
      },
    });

    expect(notifee.cancelNotification).toHaveBeenCalledWith("notif-5");
  });
});

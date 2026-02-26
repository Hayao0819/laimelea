import notifee from "@notifee/react-native";

let registeredHandler: (event: {
  type: number;
  detail: { notification?: { id?: string } };
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
    jest.clearAllMocks();
  });

  it("should register a background event handler", () => {
    expect(notifee.onBackgroundEvent).toHaveBeenCalledTimes(1);
    expect(registeredHandler).toBeDefined();
  });

  it("should cancel notification on PRESS event", async () => {
    await registeredHandler({
      type: 1, // PRESS
      detail: { notification: { id: "notif-1" } },
    });

    expect(notifee.cancelNotification).toHaveBeenCalledWith("notif-1");
  });

  it("should cancel notification on ACTION_PRESS event", async () => {
    await registeredHandler({
      type: 7, // ACTION_PRESS
      detail: { notification: { id: "notif-2" } },
    });

    expect(notifee.cancelNotification).toHaveBeenCalledWith("notif-2");
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
});

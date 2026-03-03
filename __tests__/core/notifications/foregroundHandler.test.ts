import notifee from "@notifee/react-native";

import { setupForegroundHandler } from "../../../src/core/notifications/foregroundHandler";

let registeredCallback: (event: { type: number; detail: unknown }) => void;

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    onForegroundEvent: jest.fn((cb) => {
      registeredCallback = cb;
      return jest.fn(); // unsubscribe function
    }),
  },
  EventType: { PRESS: 1, ACTION_PRESS: 7, DISMISSED: 2, DELIVERED: 3 },
}));

describe("setupForegroundHandler", () => {
  let onAlarmFired: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onAlarmFired = jest.fn();
  });

  it("should register a foreground event handler", () => {
    setupForegroundHandler(onAlarmFired);
    expect(notifee.onForegroundEvent).toHaveBeenCalledTimes(1);
  });

  it("should return unsubscribe function", () => {
    const unsubscribe = setupForegroundHandler(onAlarmFired);
    expect(typeof unsubscribe).toBe("function");
  });

  it("should call onAlarmFired on PRESS event with alarmId", () => {
    setupForegroundHandler(onAlarmFired);

    registeredCallback({
      type: 1, // PRESS
      detail: {
        notification: {
          data: { alarmId: "alarm-123" },
        },
      },
    });

    expect(onAlarmFired).toHaveBeenCalledWith("alarm-123");
  });

  it("should call onAlarmFired on ACTION_PRESS event with alarmId", () => {
    setupForegroundHandler(onAlarmFired);

    registeredCallback({
      type: 7, // ACTION_PRESS
      detail: {
        notification: {
          data: { alarmId: "alarm-456" },
        },
      },
    });

    expect(onAlarmFired).toHaveBeenCalledWith("alarm-456");
  });

  it("should NOT call onAlarmFired on DISMISSED event", () => {
    setupForegroundHandler(onAlarmFired);

    registeredCallback({
      type: 2, // DISMISSED
      detail: {
        notification: {
          data: { alarmId: "alarm-789" },
        },
      },
    });

    expect(onAlarmFired).not.toHaveBeenCalled();
  });

  it("should NOT call onAlarmFired when notification has no alarmId", () => {
    setupForegroundHandler(onAlarmFired);

    registeredCallback({
      type: 1, // PRESS
      detail: {
        notification: {
          data: {},
        },
      },
    });

    expect(onAlarmFired).not.toHaveBeenCalled();
  });

  it("should NOT call onAlarmFired when notification is undefined", () => {
    setupForegroundHandler(onAlarmFired);

    registeredCallback({
      type: 1, // PRESS
      detail: {},
    });

    expect(onAlarmFired).not.toHaveBeenCalled();
  });
});

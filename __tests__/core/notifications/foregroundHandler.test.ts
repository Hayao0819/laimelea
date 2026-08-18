import notifee from "@notifee/react-native";

import { setupForegroundHandler } from "../../../src/core/notifications/foregroundHandler";
import { processAlarmDelivery } from "../../../src/features/alarm/services/alarmDeliveryService";
import { completeTimerFromNotification } from "../../../src/features/timer/services/timerNotification";

let registeredCallback: (event: {
  type: number;
  detail: {
    notification?: { data?: Record<string, unknown> };
  };
}) => Promise<void>;

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

jest.mock("../../../src/features/alarm/services/alarmDeliveryService", () => ({
  processAlarmDelivery: jest.fn().mockResolvedValue({ handled: true }),
}));

jest.mock("../../../src/features/timer/services/timerNotification", () => ({
  completeTimerFromNotification: jest.fn().mockResolvedValue(undefined),
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

  it("opens a delivered alarm after persisting it", async () => {
    const onAlarmsUpdated = jest.fn();
    const data = {
      alarmId: "alarm-123",
      occurrenceTimestampMs: "1000000",
    };
    setupForegroundHandler(onAlarmFired, onAlarmsUpdated);

    await registeredCallback({
      type: 3,
      detail: { notification: { data } },
    });

    expect(processAlarmDelivery).toHaveBeenCalledWith(data, onAlarmsUpdated);
    expect(onAlarmFired).toHaveBeenCalledWith("alarm-123");
  });

  it("completes a delivered timer without opening the alarm screen", async () => {
    const onTimerCompleted = jest.fn();
    setupForegroundHandler(onAlarmFired, undefined, onTimerCompleted);

    await registeredCallback({
      type: 3,
      detail: { notification: { data: { timerId: "timer-123" } } },
    });

    expect(completeTimerFromNotification).toHaveBeenCalledWith("timer-123");
    expect(onTimerCompleted).toHaveBeenCalledWith("timer-123");
    expect(onAlarmFired).not.toHaveBeenCalled();
  });

  it("does not open an alarm when delivery was ignored", async () => {
    (processAlarmDelivery as jest.Mock).mockResolvedValueOnce({
      handled: false,
    });
    setupForegroundHandler(onAlarmFired);

    await registeredCallback({
      type: 3,
      detail: { notification: { data: { alarmId: "alarm-123" } } },
    });

    expect(onAlarmFired).not.toHaveBeenCalled();
  });

  it("propagates delivery persistence failures", async () => {
    (processAlarmDelivery as jest.Mock).mockRejectedValueOnce(
      new Error("schedule failed"),
    );
    setupForegroundHandler(onAlarmFired);

    await expect(
      registeredCallback({
        type: 3,
        detail: { notification: { data: { alarmId: "alarm-123" } } },
      }),
    ).rejects.toThrow("schedule failed");
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

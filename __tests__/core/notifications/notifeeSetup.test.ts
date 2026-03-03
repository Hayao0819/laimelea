import notifee from "@notifee/react-native";

import {
  ALARM_CHANNEL_ID,
  createAlarmChannel,
  createTimerChannel,
  ensureNotificationPermissions,
  TIMER_CHANNEL_ID,
} from "../../../src/core/notifications/notifeeSetup";

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue("channel-id"),
    requestPermission: jest.fn(),
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  AuthorizationStatus: { AUTHORIZED: 1, DENIED: 0 },
}));

describe("notifeeSetup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ALARM_CHANNEL_ID", () => {
    it("should be 'alarm'", () => {
      expect(ALARM_CHANNEL_ID).toBe("alarm");
    });
  });

  describe("TIMER_CHANNEL_ID", () => {
    it("should be 'timer'", () => {
      expect(TIMER_CHANNEL_ID).toBe("timer");
    });
  });

  describe("createAlarmChannel", () => {
    it("should create a channel with HIGH importance", async () => {
      await createAlarmChannel();

      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "alarm",
          name: "Alarms",
          importance: 4, // HIGH
          sound: "default",
          vibration: true,
        }),
      );
    });

    it("should return channel id", async () => {
      const result = await createAlarmChannel();
      expect(result).toBe("channel-id");
    });
  });

  describe("createTimerChannel", () => {
    it("should create a channel with DEFAULT importance", async () => {
      await createTimerChannel();

      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "timer",
          name: "Timers",
          importance: 3, // DEFAULT
          sound: "default",
          vibration: true,
        }),
      );
    });

    it("should return channel id", async () => {
      const result = await createTimerChannel();
      expect(result).toBe("channel-id");
    });
  });

  describe("ensureNotificationPermissions", () => {
    it("should return true when authorized", async () => {
      (notifee.requestPermission as jest.Mock).mockResolvedValue({
        authorizationStatus: 1, // AUTHORIZED
      });

      const result = await ensureNotificationPermissions();
      expect(result).toBe(true);
    });

    it("should return false when denied", async () => {
      (notifee.requestPermission as jest.Mock).mockResolvedValue({
        authorizationStatus: 0, // DENIED
      });

      const result = await ensureNotificationPermissions();
      expect(result).toBe(false);
    });

    it("should return true when status exceeds AUTHORIZED", async () => {
      (notifee.requestPermission as jest.Mock).mockResolvedValue({
        authorizationStatus: 2, // PROVISIONAL
      });

      const result = await ensureNotificationPermissions();
      expect(result).toBe(true);
    });
  });
});

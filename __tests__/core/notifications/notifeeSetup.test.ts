import notifee from "@notifee/react-native";
import { NativeModules } from "react-native";

import {
  ALARM_CHANNEL_ID,
  ALARM_VIBRATION_PATTERN,
  createAlarmChannel,
  createAlarmDeliveryChannel,
  createTimerChannel,
  ensureNotificationPermissions,
  getAlarmDeliveryStatus,
  openExactAlarmPermissionSettings,
  openFullScreenIntentPermissionSettings,
  TIMER_CHANNEL_ID,
} from "../../../src/core/notifications/notifeeSetup";

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue("channel-id"),
    createChannelGroup: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn(),
    getNotificationSettings: jest.fn(),
    openAlarmPermissionSettings: jest.fn().mockResolvedValue(undefined),
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  AndroidNotificationSetting: { ENABLED: 1, DISABLED: 0 },
  AuthorizationStatus: { AUTHORIZED: 1, DENIED: 0 },
}));

describe("notifeeSetup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (NativeModules as { RingtoneModule?: unknown }).RingtoneModule;
    (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
      authorizationStatus: 1,
      android: { alarm: 1 },
    });
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
    it("should create a channel with HIGH importance and DND bypass", async () => {
      await createAlarmChannel();

      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "alarm",
          name: "Alarms",
          importance: 4, // HIGH
          sound: "default",
          vibration: true,
          bypassDnd: true,
        }),
      );
    });

    it("should return channel id", async () => {
      const result = await createAlarmChannel();
      expect(result).toBe("channel-id");
    });
  });

  describe("createAlarmDeliveryChannel", () => {
    it("creates a stable channel for the same vibration setting", async () => {
      const firstId = await createAlarmDeliveryChannel(true);
      const secondId = await createAlarmDeliveryChannel(true);

      expect(firstId).toBe(secondId);
      const [firstChannel] = (notifee.createChannel as jest.Mock).mock.calls;
      expect(firstChannel[0].id).toMatch(/^alarm-v2-/);
      expect(notifee.createChannelGroup).toHaveBeenCalledWith({
        id: "alarms",
        name: "Alarms",
      });
      expect(notifee.createChannel).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: firstChannel[0].id,
          sound: undefined,
          vibration: true,
          vibrationPattern: ALARM_VIBRATION_PATTERN,
        }),
      );
    });

    it("uses only vibration-specific silent channels", async () => {
      const firstVibratingId = await createAlarmDeliveryChannel(true);
      const secondVibratingId = await createAlarmDeliveryChannel(true);
      const noVibrationId = await createAlarmDeliveryChannel(false);

      expect(firstVibratingId).toBe("channel-id");
      expect(secondVibratingId).toBe("channel-id");
      expect(noVibrationId).toBe("channel-id");
      const channelIds = (notifee.createChannel as jest.Mock).mock.calls.map(
        ([channel]) => channel.id,
      );
      expect(new Set(channelIds).size).toBe(2);
      expect(notifee.createChannel).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ sound: undefined, vibration: true }),
      );
      expect(notifee.createChannel).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ sound: undefined, vibration: true }),
      );
      expect(notifee.createChannel).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ sound: undefined, vibration: false }),
      );
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

  describe("getAlarmDeliveryStatus", () => {
    it("reports all available delivery capabilities", async () => {
      (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
        getAlarmCapabilities: jest.fn().mockResolvedValue({
          canScheduleExactAlarms: true,
          canUseFullScreenIntent: true,
        }),
      };

      await expect(getAlarmDeliveryStatus()).resolves.toEqual({
        notificationsEnabled: true,
        exactAlarmsEnabled: true,
        fullScreenIntentEnabled: true,
      });
    });

    it("reports disabled notification, exact-alarm, and full-screen permissions", async () => {
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
        authorizationStatus: 0,
        android: { alarm: 0 },
      });
      (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
        getAlarmCapabilities: jest.fn().mockResolvedValue({
          canScheduleExactAlarms: false,
          canUseFullScreenIntent: false,
        }),
      };

      await expect(getAlarmDeliveryStatus()).resolves.toEqual({
        notificationsEnabled: false,
        exactAlarmsEnabled: false,
        fullScreenIntentEnabled: false,
      });
    });

    it("uses Notifee capability when the native module is unavailable", async () => {
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
        authorizationStatus: 1,
        android: { alarm: 0 },
      });

      await expect(getAlarmDeliveryStatus()).resolves.toEqual({
        notificationsEnabled: true,
        exactAlarmsEnabled: false,
        fullScreenIntentEnabled: true,
      });
    });

    it("rejects when the native capability lookup fails", async () => {
      (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
        getAlarmCapabilities: jest
          .fn()
          .mockRejectedValue(new Error("native failure")),
      };

      await expect(getAlarmDeliveryStatus()).rejects.toThrow("native failure");
    });
  });

  describe("delivery settings", () => {
    it("opens exact-alarm settings", async () => {
      await openExactAlarmPermissionSettings();
      expect(notifee.openAlarmPermissionSettings).toHaveBeenCalledTimes(1);
    });

    it("opens full-screen settings when the native module is available", async () => {
      const openFullScreenIntentSettings = jest
        .fn()
        .mockResolvedValue(undefined);
      (NativeModules as { RingtoneModule?: unknown }).RingtoneModule = {
        openFullScreenIntentSettings,
      };

      await openFullScreenIntentPermissionSettings();
      expect(openFullScreenIntentSettings).toHaveBeenCalledTimes(1);
    });
  });
});

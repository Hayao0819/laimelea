import { NativeModules } from "react-native";

import {
  getAlarmRingtones,
  getDefaultAlarmUri,
  playRingtone,
  stopRingtone,
} from "../../../src/features/alarm/services/ringtoneService";

describe("ringtoneService", () => {
  const mockModule = {
    getAlarmRingtones: jest.fn(),
    playRingtone: jest.fn(),
    stopRingtone: jest.fn(),
    getDefaultAlarmUri: jest.fn(),
  };

  describe("with NativeModule available", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      NativeModules.RingtoneModule = mockModule;
    });

    afterEach(() => {
      delete NativeModules.RingtoneModule;
    });

    it("getAlarmRingtones should return ringtone list", async () => {
      const ringtones = [
        { title: "Default", uri: "content://ringtone/1" },
        { title: "Alarm", uri: "content://ringtone/2" },
      ];
      mockModule.getAlarmRingtones.mockResolvedValue(ringtones);

      const result = await getAlarmRingtones();
      expect(result).toEqual(ringtones);
      expect(mockModule.getAlarmRingtones).toHaveBeenCalledTimes(1);
    });

    it("playRingtone should call native module", async () => {
      mockModule.playRingtone.mockResolvedValue(undefined);
      await playRingtone("content://ringtone/1");
      expect(mockModule.playRingtone).toHaveBeenCalledWith(
        "content://ringtone/1",
      );
    });

    it("stopRingtone should call native module", async () => {
      mockModule.stopRingtone.mockResolvedValue(undefined);
      await stopRingtone();
      expect(mockModule.stopRingtone).toHaveBeenCalledTimes(1);
    });

    it("getDefaultAlarmUri should return URI from native module", async () => {
      mockModule.getDefaultAlarmUri.mockResolvedValue(
        "content://settings/system/alarm_alert",
      );
      const result = await getDefaultAlarmUri();
      expect(result).toBe("content://settings/system/alarm_alert");
    });
  });

  describe("without NativeModule (fallback)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      NativeModules.RingtoneModule = undefined;
    });

    it("getAlarmRingtones should return empty array", async () => {
      const result = await getAlarmRingtones();
      expect(result).toEqual([]);
    });

    it("playRingtone should resolve without error", async () => {
      await expect(playRingtone("content://ringtone/1")).resolves.toBeUndefined();
    });

    it("stopRingtone should resolve without error", async () => {
      await expect(stopRingtone()).resolves.toBeUndefined();
    });

    it("getDefaultAlarmUri should return 'default'", async () => {
      const result = await getDefaultAlarmUri();
      expect(result).toBe("default");
    });
  });
});

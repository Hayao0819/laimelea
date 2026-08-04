import { NativeModules } from "react-native";

import {
  cancelAlarmAudio,
  getAlarmRingtones,
  getDefaultAlarmUri,
  playAlarmSound,
  playRingtone,
  scheduleAlarmAudio,
  setAlarmVolume,
  setAlarmVolumeButtonBehavior,
  stopAlarmSound,
  stopRingtone,
} from "../../../src/features/alarm/services/ringtoneService";

describe("ringtoneService", () => {
  const mockModule = {
    getAlarmRingtones: jest.fn(),
    playRingtone: jest.fn(),
    playAlarmSound: jest.fn(),
    setAlarmVolume: jest.fn(),
    setAlarmVolumeButtonBehavior: jest.fn(),
    scheduleAlarmAudio: jest.fn(),
    cancelAlarmAudio: jest.fn(),
    stopRingtone: jest.fn(),
    stopAlarmSound: jest.fn(),
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

    it("stops only the requested active alarm", async () => {
      mockModule.stopAlarmSound.mockResolvedValue(undefined);

      await stopAlarmSound("alarm-1");

      expect(mockModule.stopAlarmSound).toHaveBeenCalledWith("alarm-1");
    });

    it("configures hardware volume button handling", async () => {
      mockModule.setAlarmVolumeButtonBehavior.mockResolvedValue(undefined);

      await setAlarmVolumeButtonBehavior("snooze");

      expect(mockModule.setAlarmVolumeButtonBehavior).toHaveBeenCalledWith(
        "snooze",
      );
    });

    it("plays alarm audio at the requested starting volume", async () => {
      mockModule.playAlarmSound.mockResolvedValue(undefined);

      await playAlarmSound("content://ringtone/1", 0.25);

      expect(mockModule.playAlarmSound).toHaveBeenCalledWith(
        "content://ringtone/1",
        0.25,
      );
    });

    it("clamps gradual-volume updates to the supported range", async () => {
      mockModule.setAlarmVolume.mockResolvedValue(undefined);

      await setAlarmVolume(2);

      expect(mockModule.setAlarmVolume).toHaveBeenCalledWith(1);
    });

    it("does not start native playback for a silent alarm", async () => {
      await playAlarmSound("__silent__", 0.5);

      expect(mockModule.playAlarmSound).not.toHaveBeenCalled();
    });

    it("propagates native playback failures", async () => {
      mockModule.playAlarmSound.mockRejectedValue(new Error("media failure"));

      await expect(playAlarmSound(null, 0)).rejects.toThrow("media failure");
    });

    it("schedules native alarm audio with non-negative durations", async () => {
      mockModule.scheduleAlarmAudio.mockResolvedValue(undefined);

      await scheduleAlarmAudio("alarm-1", 1234, null, -1, -2);

      expect(mockModule.scheduleAlarmAudio).toHaveBeenCalledWith(
        "alarm-1",
        1234,
        null,
        0,
        0,
      );
    });

    it("does not schedule native audio for a silent alarm", async () => {
      await scheduleAlarmAudio("alarm-1", 1234, "__silent__", 0, 0);

      expect(mockModule.scheduleAlarmAudio).not.toHaveBeenCalled();
    });

    it("cancels native alarm audio by alarm identifier", async () => {
      mockModule.cancelAlarmAudio.mockResolvedValue(undefined);

      await cancelAlarmAudio("alarm-1");

      expect(mockModule.cancelAlarmAudio).toHaveBeenCalledWith("alarm-1");
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
      await expect(
        playRingtone("content://ringtone/1"),
      ).resolves.toBeUndefined();
    });

    it("stopRingtone should resolve without error", async () => {
      await expect(stopRingtone()).resolves.toBeUndefined();
    });

    it("getDefaultAlarmUri should return 'default'", async () => {
      const result = await getDefaultAlarmUri();
      expect(result).toBe("default");
    });

    it("alarm playback and volume updates resolve without a native module", async () => {
      await expect(playAlarmSound(null, 0)).resolves.toBeUndefined();
      await expect(setAlarmVolume(0.5)).resolves.toBeUndefined();
      await expect(stopAlarmSound("alarm-1")).resolves.toBeUndefined();
      await expect(setAlarmVolumeButtonBehavior(null)).resolves.toBeUndefined();
    });

    it("rejects audible scheduling without the native module", async () => {
      await expect(
        scheduleAlarmAudio("alarm-1", 1234, null, 0, 0),
      ).rejects.toThrow("Alarm audio module is unavailable");
      await expect(cancelAlarmAudio("alarm-1")).resolves.toBeUndefined();
    });
  });
});

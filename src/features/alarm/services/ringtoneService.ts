/**
 * RingtoneService stub - will be fully implemented by the android-native-modules worker.
 * This provides the interface that AlarmSoundPicker depends on.
 */

export interface RingtoneInfo {
  uri: string;
  title: string;
}

export const RingtoneService = {
  async getAlarmRingtones(): Promise<RingtoneInfo[]> {
    return [];
  },

  async playPreview(_uri: string): Promise<void> {
    // No-op until native module is available
  },

  async stopPreview(): Promise<void> {
    // No-op until native module is available
  },
};

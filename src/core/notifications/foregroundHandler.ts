import notifee, { EventType } from "@notifee/react-native";

export function setupForegroundHandler(
  onAlarmFired: (alarmId: string) => void,
) {
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      const alarmId = detail.notification?.data?.alarmId;
      if (typeof alarmId === "string") {
        onAlarmFired(alarmId);
      }
    }
  });
}

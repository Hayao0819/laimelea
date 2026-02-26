import notifee, { EventType } from "@notifee/react-native";

export function setupForegroundHandler(
  onAlarmFired: (alarmId: string) => void,
) {
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (
      (type === EventType.PRESS || type === EventType.ACTION_PRESS) &&
      detail.notification?.data?.alarmId
    ) {
      onAlarmFired(detail.notification.data.alarmId as string);
    }
  });
}

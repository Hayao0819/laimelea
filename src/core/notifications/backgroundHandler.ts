import notifee, { EventType } from "@notifee/react-native";

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
    const notification = detail.notification;
    if (notification?.id) {
      // Don't cancel alarm notifications — AlarmFiringScreen handles dismissal
      const isAlarmNotification =
        typeof notification.data?.alarmId === "string";
      if (!isAlarmNotification) {
        await notifee.cancelNotification(notification.id);
      }
    }
  }

  if (type === EventType.DISMISSED) {
    // Notification swiped away — no-op for now
  }
});

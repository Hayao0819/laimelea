import notifee, { EventType } from "@notifee/react-native";

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
    if (detail.notification?.id) {
      await notifee.cancelNotification(detail.notification.id);
    }
  }

  if (type === EventType.DISMISSED) {
    // Notification swiped away — no-op for now
  }
});

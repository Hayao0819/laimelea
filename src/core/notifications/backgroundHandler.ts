import notifee, { EventType } from "@notifee/react-native";

import { processAlarmDelivery } from "../../features/alarm/services/alarmDeliveryService";

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.DELIVERED) {
    await processAlarmDelivery(detail.notification?.data);
    return;
  }

  if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
    const notification = detail.notification;
    if (notification?.id) {
      const isAlarmNotification =
        typeof notification.data?.alarmId === "string";
      if (!isAlarmNotification) {
        await notifee.cancelNotification(notification.id);
      }
    }
  }
});

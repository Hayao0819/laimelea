import notifee, { EventType } from "@notifee/react-native";

import { processAlarmDelivery } from "../../features/alarm/services/alarmDeliveryService";
import type { Alarm } from "../../models/Alarm";

export function setupForegroundHandler(
  onAlarmFired: (alarmId: string) => void,
  onAlarmsUpdated?: (alarms: Alarm[]) => void,
) {
  return notifee.onForegroundEvent(async ({ type, detail }) => {
    if (type === EventType.DELIVERED) {
      await processAlarmDelivery(detail.notification?.data, onAlarmsUpdated);
      return;
    }

    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      const alarmId = detail.notification?.data?.alarmId;
      if (typeof alarmId === "string") {
        onAlarmFired(alarmId);
      }
    }
  });
}

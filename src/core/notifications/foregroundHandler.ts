import notifee, { EventType } from "@notifee/react-native";

import { processAlarmDelivery } from "../../features/alarm/services/alarmDeliveryService";
import { completeTimerFromNotification } from "../../features/timer/services/timerNotification";
import type { Alarm } from "../../models/Alarm";

export function setupForegroundHandler(
  onAlarmFired: (alarmId: string) => void,
  onAlarmsUpdated?: (alarms: Alarm[]) => void,
  onTimerCompleted?: (timerId: string) => void | Promise<void>,
) {
  return notifee.onForegroundEvent(async ({ type, detail }) => {
    if (type === EventType.DELIVERED) {
      const timerId = detail.notification?.data?.timerId;
      if (typeof timerId === "string") {
        await completeTimerFromNotification(timerId);
        await onTimerCompleted?.(timerId);
        return;
      }
      const result = await processAlarmDelivery(
        detail.notification?.data,
        onAlarmsUpdated,
      );
      const alarmId = detail.notification?.data?.alarmId;
      if (result.handled && typeof alarmId === "string") {
        onAlarmFired(alarmId);
      }
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

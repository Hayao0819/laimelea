import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { AppState, DeviceEventEmitter } from "react-native";

import { alarmsAtom } from "../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../atoms/settingsAtoms";
import { processAlarmDelivery } from "../features/alarm/services/alarmDeliveryService";
import { rescheduleAllEnabledAlarms } from "../features/alarm/services/alarmRescheduler";
import {
  acknowledgeNativeAlarmDeliveries,
  consumeNativeAlarmDeliveries,
} from "../features/alarm/services/ringtoneService";
import { navigationRef } from "./navigation";

export function useAlarmRuntime(restoreRecoveryComplete: boolean): void {
  const settings = useAtomValue(resolvedSettingsAtom);
  const alarms = useAtomValue(alarmsAtom);
  const setAlarms = useSetAtom(alarmsAtom);
  const alarmsRef = useRef(alarms);
  const synchronizationQueueRef = useRef(Promise.resolve());
  alarmsRef.current = alarms;

  useEffect(() => {
    if (!restoreRecoveryComplete) return;
    let cancelled = false;
    const synchronizeAlarms = () => {
      const task = async () => {
        const deliveries = (await consumeNativeAlarmDeliveries())
          .slice()
          .sort(
            (left, right) =>
              left.occurrenceTimestampMs - right.occurrenceTimestampMs ||
              left.deliveryId.localeCompare(right.deliveryId),
          );
        for (const delivery of deliveries) {
          const result = await processAlarmDelivery(
            delivery,
            (updatedAlarms) => {
              alarmsRef.current = updatedAlarms;
              setAlarms(updatedAlarms);
            },
          );
          if (result.alarms) {
            try {
              await acknowledgeNativeAlarmDeliveries([delivery.deliveryId]);
            } catch {}
          }
          if (!result.handled || cancelled) continue;
          if (delivery.stopped) {
            const route = navigationRef.getCurrentRoute();
            const routeParams = route?.params;
            if (
              route?.name === "AlarmFiring" &&
              routeParams != null &&
              typeof routeParams === "object" &&
              "alarmId" in routeParams &&
              routeParams.alarmId === delivery.alarmId &&
              navigationRef.canGoBack()
            ) {
              navigationRef.goBack();
            }
            continue;
          }
          if (
            delivery.autoSilenceMs > 0 &&
            Date.now() >=
              delivery.occurrenceTimestampMs + delivery.autoSilenceMs
          ) {
            continue;
          }
          const alarmId = delivery.alarmId;
          const navigate = () => {
            if (!cancelled && navigationRef.isReady()) {
              navigationRef.navigate("AlarmFiring", { alarmId });
            }
          };
          navigate();
          if (!navigationRef.isReady()) {
            setTimeout(navigate, 100);
          }
        }
        const rescheduledAlarms = await rescheduleAllEnabledAlarms(
          alarmsRef.current,
          settings.cycleConfig,
        );
        if (!cancelled) {
          alarmsRef.current = rescheduledAlarms;
          setAlarms(rescheduledAlarms);
        }
      };
      const queued = synchronizationQueueRef.current.then(task, task);
      synchronizationQueueRef.current = queued.then(
        () => undefined,
        () => undefined,
      );
      return queued;
    };
    synchronizeAlarms().catch(() => {});
    const deliverySubscription = DeviceEventEmitter.addListener(
      "NativeAlarmDelivery",
      () => {
        synchronizeAlarms().catch(() => {});
      },
    );
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          synchronizeAlarms().catch(() => {});
        }
      },
    );
    return () => {
      cancelled = true;
      deliverySubscription.remove();
      appStateSubscription.remove();
    };
  }, [restoreRecoveryComplete, setAlarms, settings.cycleConfig]);
}

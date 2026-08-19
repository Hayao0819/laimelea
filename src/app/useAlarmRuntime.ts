import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { AppState, DeviceEventEmitter } from "react-native";

import { alarmsAtom } from "../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../atoms/settingsAtoms";
import { processAlarmDeliveryUnqueued } from "../features/alarm/services/alarmDeliveryService";
import { enqueueAlarmMutation } from "../features/alarm/services/alarmMutationQueue";
import { rescheduleAllEnabledAlarms } from "../features/alarm/services/alarmRescheduler";
import { isSameAlarmState } from "../features/alarm/services/alarmStateVersion";
import {
  acknowledgeNativeAlarmDeliveries,
  cancelAlarmAudio,
  consumeNativeAlarmDeliveries,
  getScheduledAlarmIds,
} from "../features/alarm/services/ringtoneService";
import type { Alarm } from "../models/Alarm";
import {
  completeAlarmFiringNavigation,
  enqueueAlarmFiringNavigation,
} from "./navigation";

function updateStoredAlarms(
  current: Alarm[] | Promise<Alarm[]>,
  update: (alarms: Alarm[]) => Alarm[],
): Alarm[] | Promise<Alarm[]> {
  return current instanceof Promise ? current.then(update) : update(current);
}

type AlarmDelivery = Awaited<
  ReturnType<typeof consumeNativeAlarmDeliveries>
>[number];

interface AlarmDeliveryGroup {
  delivery: AlarmDelivery;
  superseded: AlarmDelivery[];
  deliveryIds: string[];
}

function pickLatestDelivery(deliveries: AlarmDelivery[]): AlarmDelivery {
  let winner = deliveries[0];
  for (const delivery of deliveries.slice(1)) {
    if (
      delivery.occurrenceTimestampMs > winner.occurrenceTimestampMs ||
      (delivery.occurrenceTimestampMs === winner.occurrenceTimestampMs &&
        delivery.stopped &&
        !winner.stopped)
    ) {
      winner = delivery;
    }
  }
  return winner;
}

// A stopped delivery for an occurrence other than the winning one still needs
// individual processing so it can clear a stale activeOccurrenceTimestampMs;
// otherwise collapsing to only the latest occurrence would silently drop it.
export function groupLatestAlarmDeliveries(
  deliveries: Awaited<ReturnType<typeof consumeNativeAlarmDeliveries>>,
): AlarmDeliveryGroup[] {
  const byAlarm = new Map<string, AlarmDelivery[]>();
  for (const delivery of deliveries) {
    const list = byAlarm.get(delivery.alarmId);
    if (list) {
      list.push(delivery);
    } else {
      byAlarm.set(delivery.alarmId, [delivery]);
    }
  }

  const groups: AlarmDeliveryGroup[] = [];
  for (const list of byAlarm.values()) {
    const delivery = pickLatestDelivery(list);
    const superseded = list
      .filter(
        (candidate) =>
          candidate.stopped &&
          candidate.occurrenceTimestampMs !== delivery.occurrenceTimestampMs,
      )
      .sort(
        (left, right) =>
          left.occurrenceTimestampMs - right.occurrenceTimestampMs,
      );
    groups.push({
      delivery,
      superseded,
      deliveryIds: list.map((candidate) => candidate.deliveryId),
    });
  }
  return groups.sort(
    (left, right) =>
      left.delivery.occurrenceTimestampMs -
        right.delivery.occurrenceTimestampMs ||
      left.delivery.deliveryId.localeCompare(right.delivery.deliveryId),
  );
}

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
        const deliveryGroups = groupLatestAlarmDeliveries(
          await consumeNativeAlarmDeliveries(),
        );
        const handleDeliveryUpdate = async (
          _updatedAlarms: Alarm[],
          updatedAlarm: Alarm | null,
          previousAlarm: Alarm,
        ) => {
          const applyDeliveryUpdate = (storedAlarms: Alarm[]) => {
            const currentAlarm = storedAlarms.find(
              (alarm) => alarm.id === previousAlarm.id,
            );
            if (
              currentAlarm == null ||
              !isSameAlarmState(currentAlarm, previousAlarm)
            ) {
              return storedAlarms;
            }
            return updatedAlarm
              ? storedAlarms.map((alarm) =>
                  alarm.id === previousAlarm.id ? updatedAlarm : alarm,
                )
              : storedAlarms.filter((alarm) => alarm.id !== previousAlarm.id);
          };
          try {
            await setAlarms((currentAlarms) =>
              updateStoredAlarms(currentAlarms, applyDeliveryUpdate),
            );
          } catch {
            alarmsRef.current = applyDeliveryUpdate(alarmsRef.current);
          }
          alarmsRef.current = applyDeliveryUpdate(alarmsRef.current);
        };
        for (const { delivery, superseded, deliveryIds } of deliveryGroups) {
          for (const supersededDelivery of superseded) {
            const supersededResult = await processAlarmDeliveryUnqueued(
              supersededDelivery,
              handleDeliveryUpdate,
            );
            if (supersededResult.handled && !cancelled) {
              completeAlarmFiringNavigation(supersededDelivery.alarmId);
            }
          }
          const result = await processAlarmDeliveryUnqueued(
            delivery,
            handleDeliveryUpdate,
          );
          if (result.alarms) {
            try {
              await acknowledgeNativeAlarmDeliveries(deliveryIds);
            } catch {}
          }
          if (!result.handled || cancelled) continue;
          if (delivery.stopped) {
            completeAlarmFiringNavigation(delivery.alarmId);
            continue;
          }
          if (
            delivery.autoSilenceMs > 0 &&
            Date.now() >=
              delivery.occurrenceTimestampMs + delivery.autoSilenceMs
          ) {
            continue;
          }
          if (!cancelled) enqueueAlarmFiringNavigation(delivery.alarmId);
        }
        const alarmsToReschedule = alarmsRef.current;
        const rescheduledAlarms = await rescheduleAllEnabledAlarms(
          alarmsToReschedule,
          settings.cycleConfig,
        );
        const nativeAlarmIds = await getScheduledAlarmIds();
        if (nativeAlarmIds !== null) {
          const expectedAlarmIds = new Set(
            rescheduledAlarms
              .filter((alarm) => alarm.enabled)
              .map((alarm) => alarm.id),
          );
          await Promise.all(
            nativeAlarmIds
              .filter((alarmId) => !expectedAlarmIds.has(alarmId))
              .map((alarmId) => cancelAlarmAudio(alarmId)),
          );
        }
        if (!cancelled) {
          await setAlarms((currentAlarms) =>
            updateStoredAlarms(currentAlarms, (storedAlarms) => {
              const rescheduledById = new Map(
                rescheduledAlarms.map((alarm) => [alarm.id, alarm]),
              );
              const previousById = new Map(
                alarmsToReschedule.map((alarm) => [alarm.id, alarm]),
              );
              const mergedAlarms = storedAlarms.map((alarm) => {
                const previousAlarm = previousById.get(alarm.id);
                const rescheduledAlarm = rescheduledById.get(alarm.id);
                return previousAlarm &&
                  rescheduledAlarm &&
                  isSameAlarmState(alarm, previousAlarm)
                  ? rescheduledAlarm
                  : alarm;
              });
              alarmsRef.current = mergedAlarms;
              return mergedAlarms;
            }),
          );
        }
      };
      const queued = synchronizationQueueRef.current.then(
        () => enqueueAlarmMutation(task),
        () => enqueueAlarmMutation(task),
      );
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

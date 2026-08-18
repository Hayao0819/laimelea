import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";

import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import type { Alarm } from "../../../models/Alarm";
import { requestClockWidgetUpdate } from "../../widget/services/widgetUpdater";
import {
  AlarmMutationError,
  deleteAlarmSchedule,
  replaceAlarmSchedule,
  scheduleAlarmBatch,
  scheduleAlarmRecord,
  setAlarmEnabled,
  skipNextAlarmOccurrence,
} from "../services/alarmMutationService";

function updateStoredAlarms(
  current: Alarm[] | Promise<Alarm[]>,
  update: (alarms: Alarm[]) => Alarm[],
): Alarm[] | Promise<Alarm[]> {
  return current instanceof Promise ? current.then(update) : update(current);
}

export function useAlarmMutations() {
  const [alarms, setAlarms] = useAtom(alarmsAtom);
  const settings = useAtomValue(resolvedSettingsAtom);
  const cycleConfig = settings.cycleConfig;

  const updateAlarms = useCallback(
    (update: (alarms: Alarm[]) => Alarm[]) => {
      setAlarms((current) => updateStoredAlarms(current, update));
    },
    [setAlarms],
  );

  const storeRecoveredAlarm = useCallback(
    (error: unknown, expectedAlarm: Alarm) => {
      if (!(error instanceof AlarmMutationError) || !error.recoveredAlarm) {
        return;
      }
      const recoveredAlarm = error.recoveredAlarm;
      updateAlarms((current) =>
        current.map((alarm) =>
          alarm.id === recoveredAlarm.id &&
          alarm.updatedAt === expectedAlarm.updatedAt &&
          alarm.targetTimestampMs === expectedAlarm.targetTimestampMs &&
          alarm.notifeeTriggerId === expectedAlarm.notifeeTriggerId
            ? recoveredAlarm
            : alarm,
        ),
      );
    },
    [updateAlarms],
  );

  const create = useCallback(
    async (alarm: Alarm, updateWidget = true) => {
      const scheduledAlarm = await scheduleAlarmRecord(alarm, cycleConfig);
      updateAlarms((current) => [...current, scheduledAlarm]);
      if (updateWidget) requestClockWidgetUpdate();
      return scheduledAlarm;
    },
    [cycleConfig, updateAlarms],
  );

  const replace = useCallback(
    async (previousAlarm: Alarm, nextAlarm: Alarm) => {
      try {
        const scheduledAlarm = await replaceAlarmSchedule(
          previousAlarm,
          nextAlarm,
          cycleConfig,
        );
        updateAlarms((current) =>
          current.map((alarm) =>
            alarm.id === previousAlarm.id ? scheduledAlarm : alarm,
          ),
        );
        requestClockWidgetUpdate();
        return scheduledAlarm;
      } catch (error) {
        storeRecoveredAlarm(error, previousAlarm);
        throw error;
      }
    },
    [cycleConfig, storeRecoveredAlarm, updateAlarms],
  );

  const setEnabled = useCallback(
    async (alarm: Alarm, enabled: boolean) => {
      try {
        const updatedAlarm = await setAlarmEnabled(alarm, enabled, cycleConfig);
        updateAlarms((current) =>
          current.map((storedAlarm) =>
            storedAlarm.id === alarm.id ? updatedAlarm : storedAlarm,
          ),
        );
        requestClockWidgetUpdate();
        return updatedAlarm;
      } catch (error) {
        storeRecoveredAlarm(error, alarm);
        throw error;
      }
    },
    [cycleConfig, storeRecoveredAlarm, updateAlarms],
  );

  const skipNext = useCallback(
    async (alarm: Alarm) => {
      try {
        const updatedAlarm = await skipNextAlarmOccurrence(alarm, cycleConfig);
        updateAlarms((current) =>
          current.map((storedAlarm) =>
            storedAlarm.id === alarm.id ? updatedAlarm : storedAlarm,
          ),
        );
        requestClockWidgetUpdate();
        return updatedAlarm;
      } catch (error) {
        storeRecoveredAlarm(error, alarm);
        throw error;
      }
    },
    [cycleConfig, storeRecoveredAlarm, updateAlarms],
  );

  const remove = useCallback(
    async (alarm: Alarm) => {
      try {
        await deleteAlarmSchedule(alarm, cycleConfig);
        updateAlarms((current) =>
          current.filter((storedAlarm) => storedAlarm.id !== alarm.id),
        );
        requestClockWidgetUpdate();
      } catch (error) {
        storeRecoveredAlarm(error, alarm);
        throw error;
      }
    },
    [cycleConfig, storeRecoveredAlarm, updateAlarms],
  );

  const createBatch = useCallback(
    async (newAlarms: Alarm[]) => {
      try {
        const scheduledAlarms = await scheduleAlarmBatch(
          newAlarms,
          cycleConfig,
        );
        updateAlarms((current) => [...current, ...scheduledAlarms]);
        requestClockWidgetUpdate();
        return scheduledAlarms;
      } catch (error) {
        if (
          error instanceof AlarmMutationError &&
          error.retainedAlarms.length > 0
        ) {
          updateAlarms((current) => {
            const currentIds = new Set(current.map((alarm) => alarm.id));
            return [
              ...current,
              ...error.retainedAlarms.filter(
                (alarm) => !currentIds.has(alarm.id),
              ),
            ];
          });
          requestClockWidgetUpdate();
        }
        throw error;
      }
    },
    [cycleConfig, updateAlarms],
  );

  return {
    alarms,
    cycleConfig,
    createAlarm: create,
    replaceAlarm: replace,
    setAlarmEnabled: setEnabled,
    skipNextAlarm: skipNext,
    deleteAlarm: remove,
    createAlarms: createBatch,
  };
}

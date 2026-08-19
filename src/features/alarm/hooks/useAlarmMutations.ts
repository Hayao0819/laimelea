import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";

import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import type { Alarm } from "../../../models/Alarm";
import { requestClockWidgetUpdate } from "../../widget/services/widgetUpdater";
import { enqueueAlarmMutation } from "../services/alarmMutationQueue";
import {
  AlarmMutationError,
  deleteAlarmSchedule,
  replaceAlarmSchedule,
  scheduleAlarmBatch,
  scheduleAlarmRecord,
  setAlarmEnabled,
  skipNextAlarmOccurrence,
} from "../services/alarmMutationService";
import { recoverAlarmSchedule } from "../services/alarmScheduler";
import { isSameAlarmState } from "../services/alarmStateVersion";

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

  const writeAlarmsBestEffort = useCallback(
    async (update: (alarms: Alarm[]) => Alarm[]) => {
      try {
        await setAlarms((current) => updateStoredAlarms(current, update));
      } catch {}
    },
    [setAlarms],
  );

  const updateAlarms = useCallback(
    async (
      update: (alarms: Alarm[]) => Alarm[],
      rollback: (current: Alarm[], previous: Alarm[]) => Alarm[],
    ) => {
      let previousAlarms: Alarm[] | undefined;
      try {
        await setAlarms((current) =>
          updateStoredAlarms(current, (resolved) => {
            previousAlarms = resolved;
            return update(resolved);
          }),
        );
      } catch (error) {
        if (previousAlarms) {
          await writeAlarmsBestEffort((current) =>
            rollback(current, previousAlarms!),
          );
        }
        throw error;
      }
    },
    [setAlarms, writeAlarmsBestEffort],
  );

  const storeRecoveredAlarm = useCallback(
    async (error: unknown, expectedAlarm: Alarm) => {
      if (!(error instanceof AlarmMutationError) || !error.recoveredAlarm) {
        return;
      }
      const recoveredAlarm = error.recoveredAlarm;
      await writeAlarmsBestEffort((current) =>
        current.map((alarm) =>
          alarm.id === recoveredAlarm.id &&
          isSameAlarmState(alarm, expectedAlarm)
            ? recoveredAlarm
            : alarm,
        ),
      );
    },
    [writeAlarmsBestEffort],
  );

  const storeActualAlarm = useCallback(
    async (actualAlarm: Alarm, expectedAlarm?: Alarm) => {
      await writeAlarmsBestEffort((current) =>
        current.some((alarm) => alarm.id === actualAlarm.id)
          ? current.map((alarm) =>
              alarm.id === actualAlarm.id &&
              (!expectedAlarm || isSameAlarmState(alarm, expectedAlarm))
                ? actualAlarm
                : alarm,
            )
          : expectedAlarm
            ? current
            : [...current, actualAlarm],
      );
    },
    [writeAlarmsBestEffort],
  );

  const rollbackCreatedAlarm = useCallback(
    async (scheduledAlarm: Alarm) => {
      try {
        await deleteAlarmSchedule(scheduledAlarm, cycleConfig);
      } catch (rollbackError) {
        if (
          rollbackError instanceof AlarmMutationError &&
          rollbackError.recoveredAlarm
        ) {
          await storeActualAlarm(rollbackError.recoveredAlarm);
        }
      }
    },
    [cycleConfig, storeActualAlarm],
  );

  const rollbackChangedAlarm = useCallback(
    async (changedAlarm: Alarm, previousAlarm: Alarm) => {
      try {
        const restoredAlarm = await replaceAlarmSchedule(
          changedAlarm,
          previousAlarm,
          cycleConfig,
        );
        await storeActualAlarm(restoredAlarm, previousAlarm);
      } catch (rollbackError) {
        if (
          rollbackError instanceof AlarmMutationError &&
          rollbackError.recoveredAlarm
        ) {
          await storeActualAlarm(rollbackError.recoveredAlarm);
        }
      }
    },
    [cycleConfig, storeActualAlarm],
  );

  const create = useCallback(
    async (alarm: Alarm, updateWidget = true) => {
      const scheduledAlarm = await scheduleAlarmRecord(alarm, cycleConfig);
      try {
        await updateAlarms(
          (current) => [...current, scheduledAlarm],
          (current) =>
            current.filter(
              (storedAlarm) => !isSameAlarmState(storedAlarm, scheduledAlarm),
            ),
        );
      } catch (error) {
        await rollbackCreatedAlarm(scheduledAlarm);
        throw error;
      }
      if (updateWidget) requestClockWidgetUpdate();
      return scheduledAlarm;
    },
    [cycleConfig, rollbackCreatedAlarm, updateAlarms],
  );

  const replace = useCallback(
    async (previousAlarm: Alarm, nextAlarm: Alarm) => {
      let scheduledAlarm: Alarm;
      try {
        scheduledAlarm = await replaceAlarmSchedule(
          previousAlarm,
          nextAlarm,
          cycleConfig,
        );
      } catch (error) {
        await storeRecoveredAlarm(error, previousAlarm);
        throw error;
      }
      try {
        await updateAlarms(
          (current) =>
            current.map((alarm) =>
              alarm.id === previousAlarm.id ? scheduledAlarm : alarm,
            ),
          (current) =>
            current.map((alarm) =>
              isSameAlarmState(alarm, scheduledAlarm) ? previousAlarm : alarm,
            ),
        );
        requestClockWidgetUpdate();
        return scheduledAlarm;
      } catch (error) {
        await rollbackChangedAlarm(scheduledAlarm, previousAlarm);
        throw error;
      }
    },
    [cycleConfig, rollbackChangedAlarm, storeRecoveredAlarm, updateAlarms],
  );

  const setEnabled = useCallback(
    async (alarm: Alarm, enabled: boolean) => {
      let updatedAlarm: Alarm;
      try {
        updatedAlarm = await setAlarmEnabled(alarm, enabled, cycleConfig);
      } catch (error) {
        await storeRecoveredAlarm(error, alarm);
        throw error;
      }
      try {
        await updateAlarms(
          (current) =>
            current.map((storedAlarm) =>
              storedAlarm.id === alarm.id ? updatedAlarm : storedAlarm,
            ),
          (current) =>
            current.map((storedAlarm) =>
              isSameAlarmState(storedAlarm, updatedAlarm) ? alarm : storedAlarm,
            ),
        );
        requestClockWidgetUpdate();
        return updatedAlarm;
      } catch (error) {
        await rollbackChangedAlarm(updatedAlarm, alarm);
        throw error;
      }
    },
    [cycleConfig, rollbackChangedAlarm, storeRecoveredAlarm, updateAlarms],
  );

  const skipNext = useCallback(
    async (alarm: Alarm) => {
      let updatedAlarm: Alarm;
      try {
        updatedAlarm = await skipNextAlarmOccurrence(alarm, cycleConfig);
      } catch (error) {
        await storeRecoveredAlarm(error, alarm);
        throw error;
      }
      try {
        await updateAlarms(
          (current) =>
            current.map((storedAlarm) =>
              storedAlarm.id === alarm.id ? updatedAlarm : storedAlarm,
            ),
          (current) =>
            current.map((storedAlarm) =>
              isSameAlarmState(storedAlarm, updatedAlarm) ? alarm : storedAlarm,
            ),
        );
        requestClockWidgetUpdate();
        return updatedAlarm;
      } catch (error) {
        await rollbackChangedAlarm(updatedAlarm, alarm);
        throw error;
      }
    },
    [cycleConfig, rollbackChangedAlarm, storeRecoveredAlarm, updateAlarms],
  );

  const remove = useCallback(
    async (alarm: Alarm) => {
      try {
        await deleteAlarmSchedule(alarm, cycleConfig);
      } catch (error) {
        await storeRecoveredAlarm(error, alarm);
        throw error;
      }
      try {
        await updateAlarms(
          (current) =>
            current.filter((storedAlarm) => storedAlarm.id !== alarm.id),
          (current) =>
            current.some((storedAlarm) => storedAlarm.id === alarm.id)
              ? current
              : [...current, alarm],
        );
        requestClockWidgetUpdate();
      } catch (error) {
        try {
          const recoveredAlarm = await recoverAlarmSchedule(
            alarm,
            Date.now(),
            cycleConfig,
          );
          await storeActualAlarm(recoveredAlarm, alarm);
        } catch (repairError) {
          if (error instanceof Error) {
            (error as Error & { recoveryError?: unknown }).recoveryError =
              repairError;
          }
        }
        throw error;
      }
    },
    [cycleConfig, storeActualAlarm, storeRecoveredAlarm, updateAlarms],
  );

  const createBatch = useCallback(
    async (newAlarms: Alarm[]) => {
      try {
        const scheduledAlarms = await scheduleAlarmBatch(
          newAlarms,
          cycleConfig,
        );
        try {
          await updateAlarms(
            (current) => [...current, ...scheduledAlarms],
            (current) =>
              current.filter(
                (alarm) =>
                  !scheduledAlarms.some((scheduled) =>
                    isSameAlarmState(alarm, scheduled),
                  ),
              ),
          );
        } catch (error) {
          await Promise.all(scheduledAlarms.map(rollbackCreatedAlarm));
          throw error;
        }
        requestClockWidgetUpdate();
        return scheduledAlarms;
      } catch (error) {
        if (
          error instanceof AlarmMutationError &&
          error.retainedAlarms.length > 0
        ) {
          await writeAlarmsBestEffort((current) => {
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
    [cycleConfig, rollbackCreatedAlarm, updateAlarms, writeAlarmsBestEffort],
  );

  const queuedCreate = useCallback(
    (alarm: Alarm, updateWidget = true) =>
      enqueueAlarmMutation(() => create(alarm, updateWidget)),
    [create],
  );
  const queuedReplace = useCallback(
    (previousAlarm: Alarm, nextAlarm: Alarm) =>
      enqueueAlarmMutation(() => replace(previousAlarm, nextAlarm)),
    [replace],
  );
  const queuedSetEnabled = useCallback(
    (alarm: Alarm, enabled: boolean) =>
      enqueueAlarmMutation(() => setEnabled(alarm, enabled)),
    [setEnabled],
  );
  const queuedSkipNext = useCallback(
    (alarm: Alarm) => enqueueAlarmMutation(() => skipNext(alarm)),
    [skipNext],
  );
  const queuedRemove = useCallback(
    (alarm: Alarm) => enqueueAlarmMutation(() => remove(alarm)),
    [remove],
  );
  const queuedCreateBatch = useCallback(
    (newAlarms: Alarm[]) => enqueueAlarmMutation(() => createBatch(newAlarms)),
    [createBatch],
  );

  return {
    alarms,
    cycleConfig,
    createAlarm: queuedCreate,
    replaceAlarm: queuedReplace,
    setAlarmEnabled: queuedSetEnabled,
    skipNextAlarm: queuedSkipNext,
    deleteAlarm: queuedRemove,
    createAlarms: queuedCreateBatch,
  };
}

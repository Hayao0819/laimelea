import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAtomValue, useSetAtom } from "jotai";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import {
  Card,
  IconButton,
  SegmentedButtons,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../../../app/spacing";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import type { CalendarViewMode } from "../../../atoms/calendarAtoms";
import {
  calendarHasSyncedAtom,
  resolvedCalendarEventsAtom,
  visibleCalendarEventsAtom,
} from "../../../atoms/calendarAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import { findLinkedCalendarEvent } from "../../../core/calendar/calendarAlarmSync";
import { CALENDAR_SYNC_WINDOW_MS } from "../../../core/calendar/calendarSyncService";
import { useCalendarSync } from "../../../hooks/useCalendarSync";
import type { Alarm } from "../../../models/Alarm";
import type { CalendarEvent } from "../../../models/CalendarEvent";
import { useAlarmMutations } from "../../alarm/hooks/useAlarmMutations";
import { enqueueAlarmMutation } from "../../alarm/services/alarmMutationQueue";
import {
  cancelAlarm,
  recoverAlarmSchedule,
  scheduleAlarm,
} from "../../alarm/services/alarmScheduler";
import { isSameAlarmState } from "../../alarm/services/alarmStateVersion";
import { AgendaView } from "../components/AgendaView";
import { MonthView } from "../components/MonthView";
import { WeekView } from "../components/WeekView";
import { useCalendarView } from "../hooks/useCalendarView";
import {
  createLinkedAlarm,
  LinkedAlarmTransactionError,
  rescheduleLinkedAlarm,
} from "../services/linkedAlarmTransaction";

function formatNavigationTitle(
  viewMode: CalendarViewMode,
  selectedDate: number,
  weekStart: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const d = new Date(selectedDate);
  const monthName = t(`calendar.monthNames.${d.getMonth()}`);

  switch (viewMode) {
    case "month":
      return `${monthName} ${d.getFullYear()}`;
    case "week": {
      const weekStartDate = new Date(weekStart);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekStartMonthName = t(
        `calendar.monthNames.${weekStartDate.getMonth()}`,
      );
      const endMonthName = t(`calendar.monthNames.${weekEnd.getMonth()}`);
      if (weekStartDate.getMonth() === weekEnd.getMonth()) {
        return `${weekStartMonthName} ${weekStartDate.getDate()}-${weekEnd.getDate()}`;
      }
      return `${weekStartMonthName} ${weekStartDate.getDate()} - ${endMonthName} ${weekEnd.getDate()}`;
    }
    case "agenda": {
      return `${monthName} ${d.getDate()}, ${d.getFullYear()}`;
    }
  }
}

function updateStoredAlarms(
  current: Alarm[] | Promise<Alarm[]>,
  update: (alarms: Alarm[]) => Alarm[],
): Alarm[] | Promise<Alarm[]> {
  return current instanceof Promise ? current.then(update) : update(current);
}

export function CalendarScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    viewMode,
    setViewMode,
    selectedDate,
    setSelectedDate,
    weekStart,
    monthStart,
    goToToday,
    goToPrevious,
    goToNext,
  } = useCalendarView();
  const settings = useAtomValue(resolvedSettingsAtom);
  const alarms = useAtomValue(alarmsAtom);
  const alarmsRef = useRef(alarms);
  alarmsRef.current = alarms;
  const setAlarms = useSetAtom(alarmsAtom);
  const { createAlarm } = useAlarmMutations();
  const { error, sync, isStale } = useCalendarSync();
  const hasSynced = useAtomValue(calendarHasSyncedAtom);
  const allEvents = useAtomValue(resolvedCalendarEventsAtom);
  const events = useAtomValue(visibleCalendarEventsAtom);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [rescheduleAttempt, setRescheduleAttempt] = useState(0);
  const linkedAlarmSyncQueue = useRef(Promise.resolve());
  const failedReschedules = useRef(new Set<string>());
  const hasFocused = useRef(false);
  const mounted = useRef(true);

  const persistCurrentAlarm = useCallback(
    async (expectedAlarm: Alarm, nextAlarm: Alarm) => {
      let applied = false;
      try {
        await setAlarms((currentAlarms) =>
          updateStoredAlarms(currentAlarms, (storedAlarms) => {
            const currentAlarm = storedAlarms.find(
              (storedAlarm) => storedAlarm.id === expectedAlarm.id,
            );
            if (
              currentAlarm == null ||
              !isSameAlarmState(currentAlarm, expectedAlarm)
            ) {
              return storedAlarms;
            }
            applied = true;
            return storedAlarms.map((storedAlarm) =>
              storedAlarm.id === expectedAlarm.id ? nextAlarm : storedAlarm,
            );
          }),
        );
      } catch (writeError) {
        try {
          await setAlarms((currentAlarms) =>
            updateStoredAlarms(currentAlarms, (storedAlarms) =>
              storedAlarms.map((storedAlarm) =>
                storedAlarm.id === expectedAlarm.id &&
                isSameAlarmState(storedAlarm, nextAlarm)
                  ? expectedAlarm
                  : storedAlarm,
              ),
            ),
          );
        } catch {}
        throw writeError;
      }
      if (applied) {
        alarmsRef.current = alarmsRef.current.map((storedAlarm) =>
          storedAlarm.id === expectedAlarm.id ? nextAlarm : storedAlarm,
        );
      }
      return applied;
    },
    [setAlarms],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) {
        failedReschedules.current.clear();
        setRescheduleAttempt((attempt) => attempt + 1);
      } else {
        hasFocused.current = true;
      }
      if (isStale) {
        sync();
      }
    }, [isStale, sync]),
  );

  useEffect(() => {
    if (!Array.isArray(alarms) || !hasSynced) return;

    const synchronize = async () => {
      const updatedAlarms = new Map<
        string,
        {
          previousAlarm: Alarm;
          alarm: Alarm;
        }
      >();
      let failed = false;
      let movedToPast = false;

      const reconcileStaleMutation = async (
        originalAlarm: Alarm,
        scheduledAlarm: Alarm,
      ): Promise<boolean> => {
        const latestAlarm = alarmsRef.current.find(
          (current) => current.id === originalAlarm.id,
        );
        if (
          latestAlarm &&
          latestAlarm.targetTimestampMs === originalAlarm.targetTimestampMs &&
          latestAlarm.linkedCalendarEventId ===
            originalAlarm.linkedCalendarEventId &&
          latestAlarm.linkedCalendarSourceEventId ===
            originalAlarm.linkedCalendarSourceEventId
        ) {
          return false;
        }

        await cancelAlarm(scheduledAlarm).catch(() => {});
        if (latestAlarm?.enabled) {
          try {
            const notifeeTriggerId = await scheduleAlarm(latestAlarm);
            const rescheduledAlarm = { ...latestAlarm, notifeeTriggerId };
            const persisted = await persistCurrentAlarm(
              latestAlarm,
              rescheduledAlarm,
            );
            if (!persisted) {
              await cancelAlarm(rescheduledAlarm).catch(() => {});
            }
          } catch {
            const recoveredAlarm = await recoverAlarmSchedule(
              latestAlarm,
              Date.now(),
              settings.cycleConfig,
            );
            await persistCurrentAlarm(latestAlarm, recoveredAlarm).catch(
              () => {},
            );
          }
        }
        return true;
      };

      const restoreUnpersistedSchedules = async (
        persistedAlarmIds: ReadonlySet<string>,
      ) => {
        const recoveries = [...updatedAlarms.entries()]
          .filter(([alarmId]) => !persistedAlarmIds.has(alarmId))
          .map(async ([, { previousAlarm, alarm: scheduledAlarm }]) => {
            if (!previousAlarm.enabled) {
              if (scheduledAlarm.enabled) {
                await cancelAlarm(scheduledAlarm);
              }
              return;
            }
            if (scheduledAlarm.enabled) {
              await cancelAlarm(scheduledAlarm).catch(() => {});
            }
            const recoveredAlarm = await recoverAlarmSchedule(
              previousAlarm,
              Date.now(),
              settings.cycleConfig,
            );
            await persistCurrentAlarm(previousAlarm, recoveredAlarm).catch(
              () => {},
            );
          });
        await Promise.allSettled(recoveries);
      };

      for (const capturedAlarm of alarms) {
        const alarm = alarmsRef.current.find(
          (current) => current.id === capturedAlarm.id,
        );
        if (
          !alarm ||
          alarm.targetTimestampMs !== capturedAlarm.targetTimestampMs ||
          alarm.linkedCalendarEventId !== capturedAlarm.linkedCalendarEventId ||
          alarm.linkedCalendarSourceEventId !==
            capturedAlarm.linkedCalendarSourceEventId ||
          alarm.linkedCalendarEventId == null
        ) {
          continue;
        }
        const event = findLinkedCalendarEvent(alarm, allEvents);
        if (!event) {
          const expectedEventStartMs =
            alarm.targetTimestampMs - alarm.linkedEventOffsetMs;
          if (
            Math.abs(expectedEventStartMs - Date.now()) >
            CALENDAR_SYNC_WINDOW_MS
          ) {
            continue;
          }
          if (!alarm.enabled && !alarm.notifeeTriggerId) continue;
          const orphanKey = `${alarm.id}:${alarm.targetTimestampMs}:orphaned`;
          if (failedReschedules.current.has(orphanKey)) continue;
          try {
            await cancelAlarm(alarm);
            if (await reconcileStaleMutation(alarm, alarm)) continue;
            updatedAlarms.set(alarm.id, {
              previousAlarm: alarm,
              alarm: {
                ...alarm,
                enabled: false,
                notifeeTriggerId: null,
                updatedAt: Date.now(),
              },
            });
            failedReschedules.current.delete(orphanKey);
            if (mounted.current) {
              setSnackbar(t("calendar.alarmEventRemoved"));
            }
          } catch {
            failed = true;
            failedReschedules.current.add(orphanKey);
          }
          continue;
        }

        const targetTimestampMs =
          event.startTimestampMs + alarm.linkedEventOffsetMs;
        if (
          targetTimestampMs === alarm.targetTimestampMs &&
          alarm.linkedCalendarEventId === event.id &&
          alarm.linkedCalendarSourceEventId === event.sourceEventId
        ) {
          continue;
        }

        if (!alarm.enabled) {
          updatedAlarms.set(alarm.id, {
            previousAlarm: alarm,
            alarm: {
              ...alarm,
              targetTimestampMs,
              linkedCalendarEventId: event.id,
              linkedCalendarSourceEventId: event.sourceEventId,
              updatedAt: Date.now(),
            },
          });
          continue;
        }

        const rescheduleKey = `${alarm.id}:${alarm.targetTimestampMs}:${targetTimestampMs}`;
        if (failedReschedules.current.has(rescheduleKey)) continue;

        try {
          const scheduledAlarm = await rescheduleLinkedAlarm(
            alarm,
            targetTimestampMs,
            settings.cycleConfig,
          );
          const updatedAlarm = {
            ...scheduledAlarm,
            linkedCalendarEventId: event.id,
            linkedCalendarSourceEventId: event.sourceEventId,
          };
          if (await reconcileStaleMutation(alarm, updatedAlarm)) continue;
          updatedAlarms.set(alarm.id, {
            previousAlarm: alarm,
            alarm: updatedAlarm,
          });
          failedReschedules.current.delete(rescheduleKey);
          movedToPast ||= !updatedAlarm.enabled;
        } catch (rescheduleError) {
          const recoveredAlarm =
            rescheduleError instanceof LinkedAlarmTransactionError
              ? rescheduleError.recoveredAlarm
              : undefined;
          if (await reconcileStaleMutation(alarm, recoveredAlarm ?? alarm)) {
            continue;
          }
          failed = true;
          failedReschedules.current.add(rescheduleKey);
          updatedAlarms.set(alarm.id, {
            previousAlarm: alarm,
            alarm: recoveredAlarm ?? {
              ...alarm,
              enabled: false,
              notifeeTriggerId: null,
              updatedAt: Date.now(),
            },
          });
        }
      }

      if (updatedAlarms.size > 0) {
        const persistedAlarmIds = new Set<string>();
        try {
          for (const [
            alarmId,
            { previousAlarm, alarm: updatedAlarm },
          ] of updatedAlarms) {
            const persisted = await persistCurrentAlarm(
              previousAlarm,
              updatedAlarm,
            );
            if (!persisted) {
              await cancelAlarm(updatedAlarm).catch(() => {});
              const latestAlarm = alarmsRef.current.find(
                (storedAlarm) => storedAlarm.id === previousAlarm.id,
              );
              if (latestAlarm?.enabled) {
                const recoveredAlarm = await recoverAlarmSchedule(
                  latestAlarm,
                  Date.now(),
                  settings.cycleConfig,
                );
                if (await persistCurrentAlarm(latestAlarm, recoveredAlarm)) {
                  persistedAlarmIds.add(alarmId);
                }
              }
            } else {
              persistedAlarmIds.add(alarmId);
            }
          }
        } catch {
          await restoreUnpersistedSchedules(persistedAlarmIds);
          failed = true;
        }
      }
      if (mounted.current && failed) {
        setSnackbar(t("calendar.alarmRescheduleFailed"));
      } else if (mounted.current && movedToPast) {
        setSnackbar(t("calendar.alarmTimePassed"));
      }
    };

    linkedAlarmSyncQueue.current = linkedAlarmSyncQueue.current.then(
      () => enqueueAlarmMutation(synchronize),
      () => enqueueAlarmMutation(synchronize),
    );
  }, [
    alarms,
    allEvents,
    hasSynced,
    rescheduleAttempt,
    persistCurrentAlarm,
    settings.cycleConfig,
    t,
  ]);

  const handleCreateAlarm = useCallback(
    async (event: CalendarEvent) => {
      const alarm = createLinkedAlarm(event, settings);

      if (alarm.targetTimestampMs <= Date.now()) {
        setSnackbar(t("calendar.alarmTimePassed"));
        return;
      }

      try {
        await createAlarm(alarm);
        setSnackbar(t("calendar.alarmCreated", { title: event.title }));
      } catch {
        setSnackbar(t("calendar.alarmScheduleFailed"));
      }
    },
    [createAlarm, settings, t],
  );

  const handleEventPress = useCallback(
    (event: CalendarEvent) => {
      navigation.navigate("EventDetail", { eventId: event.id });
    },
    [navigation],
  );

  const navTitle = formatNavigationTitle(viewMode, selectedDate, weekStart, t);

  const viewButtons = useMemo(
    () => [
      { value: "month" as const, label: t("calendar.views.month") },
      { value: "week" as const, label: t("calendar.views.week") },
      { value: "agenda" as const, label: t("calendar.views.agenda") },
    ],
    [t],
  );

  const renderViewContent = () => {
    switch (viewMode) {
      case "month":
        return (
          <MonthView
            events={events}
            selectedDate={selectedDate}
            monthStart={monthStart}
            firstDayOfWeek={settings.calendarFirstDayOfWeek}
            onSelectDate={setSelectedDate}
            onEventPress={handleEventPress}
            onCreateAlarm={handleCreateAlarm}
          />
        );
      case "week":
        return (
          <WeekView
            events={events}
            selectedDate={selectedDate}
            weekStart={weekStart}
            firstDayOfWeek={settings.calendarFirstDayOfWeek}
            onSelectDate={setSelectedDate}
            onEventPress={handleEventPress}
            onCreateAlarm={handleCreateAlarm}
          />
        );
      case "agenda":
        return (
          <AgendaView
            events={events}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onEventPress={handleEventPress}
            onCreateAlarm={handleCreateAlarm}
          />
        );
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingLeft: insets.left, paddingRight: insets.right },
      ]}
      testID="calendar-screen"
    >
      {/* View mode selector */}
      <View style={styles.segmentedContainer}>
        <SegmentedButtons<CalendarViewMode>
          value={viewMode}
          onValueChange={(v) => setViewMode(v)}
          buttons={viewButtons}
        />
      </View>

      {/* Navigation header */}
      <View style={styles.navHeader}>
        <IconButton
          icon="chevron-left"
          onPress={goToPrevious}
          size={24}
          accessibilityLabel={t("calendar.previousPeriod")}
        />
        <View style={styles.navTitleContainer}>
          <Text
            variant="titleMedium"
            style={styles.navTitle}
            testID="calendar-navigation-title"
          >
            {navTitle}
          </Text>
        </View>
        <IconButton
          icon="chevron-right"
          onPress={goToNext}
          size={24}
          accessibilityLabel={t("calendar.nextPeriod")}
        />
        <IconButton
          icon="calendar-today"
          onPress={goToToday}
          size={20}
          accessibilityLabel={t("calendar.today")}
        />
      </View>

      {/* Error card */}
      {error && (
        <Card style={styles.errorCard} mode="outlined">
          <Card.Content>
            <Text style={{ color: theme.colors.error }}>
              {t("calendar.syncError")}
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* View content */}
      {renderViewContent()}

      <Snackbar
        visible={snackbar != null}
        onDismiss={() => setSnackbar(null)}
        duration={3000}
      >
        {snackbar ?? ""}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentedContainer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  navTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  navTitle: {
    textAlign: "center",
  },
  errorCard: {
    marginHorizontal: spacing.base,
    marginVertical: spacing.sm,
  },
});

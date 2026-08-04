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

import { spacing } from "../../../app/spacing";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import type { CalendarViewMode } from "../../../atoms/calendarAtoms";
import {
  resolvedCalendarEventsAtom,
  visibleCalendarEventsAtom,
} from "../../../atoms/calendarAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import { useCalendarSync } from "../../../hooks/useCalendarSync";
import type { Alarm } from "../../../models/Alarm";
import type { CalendarEvent } from "../../../models/CalendarEvent";
import {
  cancelAlarm,
  scheduleAlarm,
} from "../../alarm/services/alarmScheduler";
import { AgendaView } from "../components/AgendaView";
import { MonthView } from "../components/MonthView";
import { WeekView } from "../components/WeekView";
import { useCalendarView } from "../hooks/useCalendarView";
import {
  LinkedAlarmTransactionError,
  rescheduleLinkedAlarm,
  scheduleNewLinkedAlarm,
} from "../services/linkedAlarmTransaction";

function formatNavigationTitle(
  viewMode: CalendarViewMode,
  selectedDate: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const d = new Date(selectedDate);
  const monthName = t(`calendar.monthNames.${d.getMonth()}`);

  switch (viewMode) {
    case "month":
      return `${monthName} ${d.getFullYear()}`;
    case "week": {
      const weekEnd = new Date(selectedDate);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const endMonthName = t(`calendar.monthNames.${weekEnd.getMonth()}`);
      if (d.getMonth() === weekEnd.getMonth()) {
        return `${monthName} ${d.getDate()}-${weekEnd.getDate()}`;
      }
      return `${monthName} ${d.getDate()} - ${endMonthName} ${weekEnd.getDate()}`;
    }
    case "agenda": {
      return `${monthName} ${d.getDate()}, ${d.getFullYear()}`;
    }
  }
}

export function CalendarScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();
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
  const { error, sync, isStale } = useCalendarSync();
  const allEvents = useAtomValue(resolvedCalendarEventsAtom);
  const events = useAtomValue(visibleCalendarEventsAtom);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [rescheduleAttempt, setRescheduleAttempt] = useState(0);
  const linkedAlarmSyncQueue = useRef(Promise.resolve());
  const failedReschedules = useRef(new Set<string>());
  const hasFocused = useRef(false);
  const mounted = useRef(true);

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
    if (!Array.isArray(alarms) || allEvents.length === 0) return;

    const eventsById = new Map<string, CalendarEvent>();
    for (const event of allEvents) {
      eventsById.set(event.id, event);
      eventsById.set(event.sourceEventId, event);
    }

    const synchronize = async () => {
      const updatedAlarms = new Map<
        string,
        { previousTargetTimestampMs: number; alarm: Alarm }
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
            originalAlarm.linkedCalendarEventId
        ) {
          return false;
        }

        await cancelAlarm(scheduledAlarm).catch(() => {});
        if (latestAlarm?.enabled) {
          try {
            const notifeeTriggerId = await scheduleAlarm(latestAlarm);
            setAlarms((current) =>
              Array.isArray(current)
                ? current.map((item) =>
                    item.id === latestAlarm.id &&
                    item.targetTimestampMs === latestAlarm.targetTimestampMs
                      ? { ...item, notifeeTriggerId }
                      : item,
                  )
                : current,
            );
          } catch {
            setAlarms((current) =>
              Array.isArray(current)
                ? current.map((item) =>
                    item.id === latestAlarm.id &&
                    item.targetTimestampMs === latestAlarm.targetTimestampMs
                      ? {
                          ...item,
                          enabled: false,
                          notifeeTriggerId: null,
                          updatedAt: Date.now(),
                        }
                      : item,
                  )
                : current,
            );
          }
        }
        return true;
      };

      for (const capturedAlarm of alarms) {
        const alarm = alarmsRef.current.find(
          (current) => current.id === capturedAlarm.id,
        );
        if (
          !alarm ||
          alarm.targetTimestampMs !== capturedAlarm.targetTimestampMs ||
          alarm.linkedCalendarEventId !== capturedAlarm.linkedCalendarEventId ||
          alarm.linkedCalendarEventId == null
        ) {
          continue;
        }
        const event = eventsById.get(alarm.linkedCalendarEventId);
        if (!event) continue;

        const targetTimestampMs =
          event.startTimestampMs + alarm.linkedEventOffsetMs;
        if (targetTimestampMs === alarm.targetTimestampMs) continue;

        if (!alarm.enabled) {
          updatedAlarms.set(alarm.id, {
            previousTargetTimestampMs: alarm.targetTimestampMs,
            alarm: {
              ...alarm,
              targetTimestampMs,
              updatedAt: Date.now(),
            },
          });
          continue;
        }

        const rescheduleKey = `${alarm.id}:${alarm.targetTimestampMs}:${targetTimestampMs}`;
        if (failedReschedules.current.has(rescheduleKey)) continue;

        try {
          const updatedAlarm = await rescheduleLinkedAlarm(
            alarm,
            targetTimestampMs,
          );
          if (await reconcileStaleMutation(alarm, updatedAlarm)) continue;
          updatedAlarms.set(alarm.id, {
            previousTargetTimestampMs: alarm.targetTimestampMs,
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
            previousTargetTimestampMs: alarm.targetTimestampMs,
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
        setAlarms((current) =>
          Array.isArray(current)
            ? current.map((item) => {
                const update = updatedAlarms.get(item.id);
                return update &&
                  item.targetTimestampMs === update.previousTargetTimestampMs
                  ? update.alarm
                  : item;
              })
            : current,
        );
      }
      if (mounted.current && failed) {
        setSnackbar(t("calendar.alarmRescheduleFailed"));
      } else if (mounted.current && movedToPast) {
        setSnackbar(t("calendar.alarmTimePassed"));
      }
    };

    linkedAlarmSyncQueue.current = linkedAlarmSyncQueue.current.then(
      synchronize,
      synchronize,
    );
  }, [alarms, allEvents, rescheduleAttempt, setAlarms, t]);

  const handleCreateAlarm = useCallback(
    async (event: CalendarEvent) => {
      const now = Date.now();
      const offsetMs = -settings.defaultEventReminderMin * 60 * 1000;
      const { alarmDefaults } = settings;

      const alarm: Alarm = {
        id: `alarm-${now}-${Math.random().toString(36).slice(2, 8)}`,
        label: event.title,
        enabled: true,
        targetTimestampMs: event.startTimestampMs + offsetMs,
        setInTimeSystem: "24h",
        repeat: null,
        dismissalMethod: alarmDefaults.dismissalMethod,
        gradualVolumeDurationSec: alarmDefaults.gradualVolumeDurationSec,
        snoozeDurationMin: alarmDefaults.snoozeDurationMin,
        snoozeMaxCount: alarmDefaults.snoozeMaxCount,
        snoozeCount: 0,
        autoSilenceMin: 10,
        soundUri: null,
        vibrationEnabled: alarmDefaults.vibrationEnabled,
        notifeeTriggerId: null,
        skipNextOccurrence: false,
        linkedCalendarEventId: event.id,
        linkedEventOffsetMs: offsetMs,
        mathDifficulty: alarmDefaults.mathDifficulty,
        lastFiredAt: null,
        createdAt: now,
        updatedAt: now,
      };

      try {
        const scheduledAlarm = await scheduleNewLinkedAlarm(alarm);
        setAlarms((prev) =>
          Array.isArray(prev) ? [...prev, scheduledAlarm] : [scheduledAlarm],
        );
        setSnackbar(t("calendar.alarmCreated", { title: event.title }));
      } catch (scheduleError) {
        setSnackbar(
          t(
            scheduleError instanceof LinkedAlarmTransactionError &&
              scheduleError.reason === "past"
              ? "calendar.alarmTimePassed"
              : "calendar.alarmScheduleFailed",
          ),
        );
      }
    },
    [settings, setAlarms, t],
  );

  const handleEventPress = useCallback(
    (event: CalendarEvent) => {
      navigation.navigate("EventDetail", { eventId: event.id });
    },
    [navigation],
  );

  const navTitle = formatNavigationTitle(viewMode, selectedDate, t);

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
    <View style={styles.container} testID="calendar-screen">
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
          accessibilityLabel={t("calendar.scrollToToday")}
        />
        <View style={styles.navTitleContainer}>
          <Text variant="titleMedium" style={styles.navTitle}>
            {navTitle}
          </Text>
        </View>
        <IconButton
          icon="chevron-right"
          onPress={goToNext}
          size={24}
          accessibilityLabel={t("calendar.scrollToToday")}
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

import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAtomValue, useSetAtom } from "jotai";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { visibleCalendarEventsAtom } from "../../../atoms/calendarAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import { syncCalendarAlarms } from "../../../core/calendar/calendarAlarmSync";
import { useCalendarSync } from "../../../hooks/useCalendarSync";
import type { Alarm } from "../../../models/Alarm";
import type { CalendarEvent } from "../../../models/CalendarEvent";
import { scheduleAlarm } from "../../alarm/services/alarmScheduler";
import { AgendaView } from "../components/AgendaView";
import { MonthView } from "../components/MonthView";
import { WeekView } from "../components/WeekView";
import { useCalendarView } from "../hooks/useCalendarView";

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
  const setAlarms = useSetAtom(alarmsAtom);
  const { error, sync, isStale } = useCalendarSync();
  const events = useAtomValue(visibleCalendarEventsAtom);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // Auto-sync when tab is focused and cache is stale
  useFocusEffect(
    useCallback(() => {
      if (isStale) {
        sync();
      }
    }, [isStale, sync]),
  );

  // Sync linked alarm times when calendar events change
  useEffect(() => {
    if (events.length === 0) return;
    setAlarms((prevAlarms) => {
      // Guard: atomWithStorage with async storage may pass a Promise
      // before the stored value is resolved
      if (!Array.isArray(prevAlarms)) return prevAlarms;
      const linkedAlarms = prevAlarms.filter(
        (a) => a.linkedCalendarEventId != null,
      );
      if (linkedAlarms.length === 0) return prevAlarms;
      const { updatedAlarms } = syncCalendarAlarms(prevAlarms, events);
      const hasChanges = updatedAlarms.some(
        (a, i) => a.updatedAt !== prevAlarms[i]?.updatedAt,
      );
      return hasChanges ? updatedAlarms : prevAlarms;
    });
  }, [events, setAlarms]);

  const handleCreateAlarm = useCallback(
    async (event: CalendarEvent) => {
      const now = Date.now();
      const offsetMs = -settings.defaultEventReminderMin * 60 * 1000;
      const { alarmDefaults } = settings;

      const alarm: Alarm = {
        id: `alarm-${now}`,
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

      setAlarms((prev) => (Array.isArray(prev) ? [...prev, alarm] : [alarm]));
      await scheduleAlarm(alarm);
      setSnackbar(t("calendar.alarmCreated", { title: event.title }));
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

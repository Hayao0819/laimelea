import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import {
  Text,
  Card,
  Button,
  Snackbar,
  SegmentedButtons,
  IconButton,
  useTheme,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useAtomValue, useSetAtom } from "jotai";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { spacing } from "../../../app/spacing";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import { platformServicesAtom } from "../../../atoms/platformAtoms";
import { useCalendarSync } from "../../../hooks/useCalendarSync";
import { useCalendarView } from "../hooks/useCalendarView";
import { syncCalendarAlarms } from "../../../core/calendar/calendarAlarmSync";
import { scheduleAlarm } from "../../alarm/services/alarmScheduler";
import { DaySelector } from "../components/DaySelector";
import { MonthView } from "../components/MonthView";
import { WeekView } from "../components/WeekView";
import { AgendaView } from "../components/AgendaView";
import type { CalendarEvent } from "../../../models/CalendarEvent";
import type { Alarm } from "../../../models/Alarm";
import type { CalendarViewMode } from "../../../atoms/calendarAtoms";

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
  const services = useAtomValue(platformServicesAtom);
  const settings = useAtomValue(resolvedSettingsAtom);
  const setAlarms = useSetAtom(alarmsAtom);
  const { events, error, sync, isStale } = useCalendarSync();
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
        lastFiredAt: null,
        createdAt: now,
        updatedAt: now,
      };

      setAlarms((prev) => [...prev, alarm]);
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

  const handleSignIn = useCallback(async () => {
    try {
      await services.auth.signIn();
      sync(true);
    } catch {
      // Sign-in cancelled or failed
    }
  }, [services.auth, sync]);

  const navTitle = formatNavigationTitle(viewMode, selectedDate, t);

  const viewButtons = useMemo(
    () => [
      { value: "month", label: t("calendar.views.month") },
      { value: "week", label: t("calendar.views.week") },
      { value: "agenda", label: t("calendar.views.agenda") },
    ],
    [t],
  );

  // Unauthenticated state
  const [isAuthed, setIsAuthed] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    services.auth.getAccessToken().then((token) => setIsAuthed(token != null));
  }, [services.auth]);

  if (isAuthed === false && events.length === 0) {
    return (
      <View style={styles.container} testID="calendar-screen">
        <DaySelector
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
        <View style={styles.signInContainer}>
          <Card style={styles.signInCard} mode="outlined">
            <Card.Content style={styles.signInContent}>
              <Text variant="bodyLarge">{t("calendar.signInRequired")}</Text>
              <Button
                mode="contained"
                onPress={handleSignIn}
                style={styles.signInButton}
                accessibilityLabel={t("calendar.signIn")}
              >
                {t("calendar.signIn")}
              </Button>
            </Card.Content>
          </Card>
        </View>
      </View>
    );
  }

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
        <SegmentedButtons
          value={viewMode}
          onValueChange={(v) => setViewMode(v as CalendarViewMode)}
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
  signInContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  signInCard: {
    width: "100%",
  },
  signInContent: {
    alignItems: "center",
    gap: spacing.base,
  },
  signInButton: {
    marginTop: spacing.sm,
  },
});

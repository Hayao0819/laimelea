import React, { useCallback, useMemo, useState } from "react";
import { View, FlatList, RefreshControl, StyleSheet } from "react-native";
import { Text, Card, Button, Snackbar, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useFocusEffect } from "@react-navigation/native";
import { calendarSelectedDateAtom } from "../../../atoms/calendarAtoms";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import { platformServicesAtom } from "../../../atoms/platformAtoms";
import { useCalendarSync } from "../../../hooks/useCalendarSync";
import { scheduleAlarm } from "../../alarm/services/alarmScheduler";
import { DaySelector } from "../components/DaySelector";
import { EventCard } from "../components/EventCard";
import type { CalendarEvent } from "../../../models/CalendarEvent";
import type { Alarm } from "../../../models/Alarm";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isSameDay(ms1: number, ms2: number): boolean {
  const d1 = new Date(ms1);
  const d2 = new Date(ms2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function CalendarScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [selectedDate, setSelectedDate] = useAtom(calendarSelectedDateAtom);
  const services = useAtomValue(platformServicesAtom);
  const settings = useAtomValue(resolvedSettingsAtom);
  const setAlarms = useSetAtom(alarmsAtom);
  const { events, loading, error, sync, isStale } = useCalendarSync();
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // Auto-sync when tab is focused and cache is stale
  useFocusEffect(
    useCallback(() => {
      if (isStale) {
        sync();
      }
    }, [isStale, sync]),
  );

  const dayEvents = useMemo(() => {
    return events
      .filter((e) => {
        if (e.allDay) {
          // All-day events span multiple days
          return (
            e.startTimestampMs <= selectedDate + MS_PER_DAY &&
            e.endTimestampMs > selectedDate
          );
        }
        return isSameDay(e.startTimestampMs, selectedDate);
      })
      .sort((a, b) => {
        // All-day events first, then by start time
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return a.startTimestampMs - b.startTimestampMs;
      });
  }, [events, selectedDate]);

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

  const handleRefresh = useCallback(() => {
    sync(true);
  }, [sync]);

  const handleSignIn = useCallback(async () => {
    try {
      await services.auth.signIn();
      sync(true);
    } catch {
      // Sign-in cancelled or failed
    }
  }, [services.auth, sync]);

  const renderItem = useCallback(
    ({ item }: { item: CalendarEvent }) => (
      <EventCard event={item} onCreateAlarm={handleCreateAlarm} />
    ),
    [handleCreateAlarm],
  );

  const keyExtractor = useCallback((item: CalendarEvent) => item.id, []);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.empty}>
        <Text variant="bodyLarge">{t("calendar.noEvents")}</Text>
      </View>
    );
  }, [loading, t]);

  const renderHeader = useCallback(
    () => (
      <View>
        <DaySelector
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
        {error && (
          <Card style={styles.errorCard} mode="outlined">
            <Card.Content>
              <Text style={{ color: theme.colors.error }}>
                {t("calendar.syncError")}
              </Text>
            </Card.Content>
          </Card>
        )}
      </View>
    ),
    [selectedDate, setSelectedDate, error, theme, t],
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
              >
                {t("calendar.signIn")}
              </Button>
            </Card.Content>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="calendar-screen">
      <FlatList
        data={dayEvents}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
        }
        contentContainerStyle={
          dayEvents.length === 0 ? styles.emptyList : styles.list
        }
        testID="calendar-event-list"
      />
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
  list: {
    paddingBottom: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 64,
  },
  errorCard: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  signInContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  signInCard: {
    width: "100%",
  },
  signInContent: {
    alignItems: "center",
    gap: 16,
  },
  signInButton: {
    marginTop: 8,
  },
});

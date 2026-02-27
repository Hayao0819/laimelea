import React, { useMemo, useCallback } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Card, Button, Chip, Divider, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAtomValue } from "jotai";
import { useSetAtom } from "jotai";
import { format } from "date-fns";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../navigation/types";
import { calendarEventsAtom } from "../../../atoms/calendarAtoms";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import { realToCustom } from "../../../core/time/conversions";
import { formatCustomTimeShort } from "../../../core/time/formatting";
import { scheduleAlarm } from "../../alarm/services/alarmScheduler";
import type { CalendarEvent } from "../../../models/CalendarEvent";
import type { Alarm } from "../../../models/Alarm";

type Props = NativeStackScreenProps<RootStackParamList, "EventDetail">;

function formatDateTime(ms: number): string {
  return format(new Date(ms), "yyyy/MM/dd HH:mm");
}

function formatDateOnly(ms: number): string {
  return format(new Date(ms), "yyyy/MM/dd");
}

export function EventDetailScreen() {
  const navigation = useNavigation<Props["navigation"]>();
  const route = useRoute<Props["route"]>();
  const { t } = useTranslation();
  const theme = useTheme();
  const events = useAtomValue(calendarEventsAtom);
  const settings = useAtomValue(resolvedSettingsAtom);
  const setAlarms = useSetAtom(alarmsAtom);

  const { eventId } = route.params;

  const event = useMemo(
    () => events.find((e) => e.id === eventId),
    [events, eventId],
  );

  const handleCreateAlarm = useCallback(
    async (ev: CalendarEvent) => {
      const now = Date.now();
      const offsetMs = -settings.defaultEventReminderMin * 60 * 1000;
      const { alarmDefaults } = settings;

      const alarm: Alarm = {
        id: `alarm-${now}`,
        label: ev.title,
        enabled: true,
        targetTimestampMs: ev.startTimestampMs + offsetMs,
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
        linkedCalendarEventId: ev.id,
        linkedEventOffsetMs: offsetMs,
        lastFiredAt: null,
        createdAt: now,
        updatedAt: now,
      };

      setAlarms((prev) => [...prev, alarm]);
      await scheduleAlarm(alarm);
      navigation.goBack();
    },
    [settings, setAlarms, navigation],
  );

  if (!event) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        testID="event-detail-screen"
      >
        <View style={styles.notFound}>
          <Text variant="bodyLarge">{t("calendar.eventNotFound")}</Text>
        </View>
      </View>
    );
  }

  const customStart = realToCustom(
    event.startTimestampMs,
    settings.cycleConfig,
  );
  const customEnd = realToCustom(event.endTimestampMs, settings.cycleConfig);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      testID="event-detail-screen"
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View
            style={[
              styles.colorDot,
              {
                backgroundColor: event.colorId ?? theme.colors.primary,
              },
            ]}
          />
          <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
            {event.calendarName}
          </Text>
        </View>

        <Text variant="headlineSmall" style={styles.title}>
          {event.title}
        </Text>

        {event.allDay && (
          <Chip compact style={styles.allDayChip} testID="all-day-chip">
            {t("calendar.allDay")}
          </Chip>
        )}

        <Card style={styles.detailCard} mode="outlined">
          <Card.Content style={styles.detailContent}>
            <View style={styles.detailRow}>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.outline }}
              >
                {t("calendar.eventStart")}
              </Text>
              <Text variant="bodyMedium">
                {event.allDay
                  ? formatDateOnly(event.startTimestampMs)
                  : formatDateTime(event.startTimestampMs)}
              </Text>
              {!event.allDay && (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.primary }}
                >
                  {t("calendar.customTime", {
                    time: formatCustomTimeShort(customStart),
                  })}
                </Text>
              )}
            </View>

            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.outline }}
              >
                {t("calendar.eventEnd")}
              </Text>
              <Text variant="bodyMedium">
                {event.allDay
                  ? formatDateOnly(event.endTimestampMs)
                  : formatDateTime(event.endTimestampMs)}
              </Text>
              {!event.allDay && (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.primary }}
                >
                  {t("calendar.customTime", {
                    time: formatCustomTimeShort(customEnd),
                  })}
                </Text>
              )}
            </View>
          </Card.Content>
        </Card>

        {event.description.length > 0 && (
          <Card
            style={styles.detailCard}
            mode="outlined"
            testID="description-card"
          >
            <Card.Content>
              <Text
                variant="labelMedium"
                style={[styles.sectionLabel, { color: theme.colors.outline }]}
              >
                {t("calendar.eventDescription")}
              </Text>
              <Text variant="bodyMedium">{event.description}</Text>
            </Card.Content>
          </Card>
        )}

        <Card style={styles.detailCard} mode="outlined">
          <Card.Content style={styles.detailContent}>
            <View style={styles.detailRow}>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.outline }}
              >
                {t("calendar.eventCalendar")}
              </Text>
              <Text variant="bodyMedium">{event.calendarName}</Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.outline }}
              >
                {t("calendar.source")}
              </Text>
              <Text variant="bodyMedium">{event.source}</Text>
            </View>
          </Card.Content>
        </Card>

        {!event.allDay && (
          <Button
            mode="contained"
            icon="alarm-plus"
            onPress={() => handleCreateAlarm(event)}
            style={styles.alarmButton}
            testID="create-alarm-button"
          >
            {t("calendar.createAlarm")}
          </Button>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    gap: 16,
  },
  notFound: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  title: {
    marginTop: 4,
  },
  allDayChip: {
    alignSelf: "flex-start",
  },
  detailCard: {
    borderRadius: 12,
  },
  detailContent: {
    gap: 0,
  },
  detailRow: {
    paddingVertical: 8,
    gap: 2,
  },
  divider: {
    marginVertical: 0,
  },
  sectionLabel: {
    marginBottom: 8,
  },
  alarmButton: {
    marginTop: 8,
  },
});

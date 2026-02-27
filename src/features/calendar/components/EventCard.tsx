import React from "react";
import { View, StyleSheet } from "react-native";
import { Card, Text, IconButton, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { settingsAtom } from "../../../atoms/settingsAtoms";
import { realToCustom } from "../../../core/time/conversions";
import { formatCustomTimeShort } from "../../../core/time/formatting";
import type { CalendarEvent } from "../../../models/CalendarEvent";

interface EventCardProps {
  event: CalendarEvent;
  onCreateAlarm?: (event: CalendarEvent) => void;
  onPress?: (event: CalendarEvent) => void;
}

function formatRealTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function formatDuration(startMs: number, endMs: number): string {
  const diffMs = endMs - startMs;
  if (diffMs <= 0) return "";

  if (diffMs >= MS_PER_DAY) {
    const days = Math.round(diffMs / MS_PER_DAY);
    return `${days}d`;
  }

  const totalMinutes = Math.round(diffMs / MS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

function formatDurationI18n(
  startMs: number,
  endMs: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const diffMs = endMs - startMs;
  if (diffMs <= 0) return "";

  if (diffMs >= MS_PER_DAY) {
    const days = Math.round(diffMs / MS_PER_DAY);
    return t("calendar.duration.days", { d: days });
  }

  const totalMinutes = Math.round(diffMs / MS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return t("calendar.duration.hoursMinutes", { h: hours, m: minutes });
  }
  if (hours > 0) {
    return t("calendar.duration.hours", { h: hours });
  }
  return t("calendar.duration.minutes", { m: minutes });
}

export function EventCard({ event, onCreateAlarm, onPress }: EventCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const settings = useAtomValue(settingsAtom);

  const eventColor = event.colorId ?? theme.colors.primary;
  const isZeroDuration = event.startTimestampMs === event.endTimestampMs;

  const customStartTime = realToCustom(
    event.startTimestampMs,
    settings.cycleConfig,
  );
  const customStartStr = formatCustomTimeShort(customStartTime);

  const customEndTime = realToCustom(
    event.endTimestampMs,
    settings.cycleConfig,
  );
  const customEndStr = formatCustomTimeShort(customEndTime);

  const durationStr = isZeroDuration
    ? ""
    : formatDurationI18n(event.startTimestampMs, event.endTimestampMs, t);

  const allDayBg = event.allDay
    ? { backgroundColor: eventColor + "26" }
    : undefined;

  return (
    <Card
      style={[
        styles.card,
        { borderLeftWidth: 4, borderLeftColor: eventColor },
        allDayBg,
      ]}
      mode="outlined"
      onPress={onPress ? () => onPress(event) : undefined}
      accessibilityLabel={`${event.title}${event.allDay ? `, ${t("calendar.allDay")}` : `, ${formatRealTime(event.startTimestampMs)}`}`}
    >
      <Card.Content style={styles.content}>
        <View style={styles.row}>
          <View style={styles.textContainer}>
            {event.allDay ? (
              <View style={styles.allDayRow}>
                <Text variant="titleMedium" numberOfLines={1} style={styles.allDayTitle}>
                  {event.title}
                </Text>
                <Text variant="bodySmall" style={styles.allDayLabel}>
                  {t("calendar.allDay")}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.titleRow}>
                  <Text variant="titleMedium" numberOfLines={1} style={styles.title}>
                    {event.title}
                  </Text>
                </View>
                <View style={styles.timeRow}>
                  <Text variant="bodyMedium" style={styles.realTime}>
                    {t("calendar.timeRange", {
                      start: formatRealTime(event.startTimestampMs),
                      end: formatRealTime(event.endTimestampMs),
                    })}
                  </Text>
                  {durationStr !== "" && (
                    <>
                      <Text variant="bodySmall" style={styles.separator}>
                        {"\u00B7"}
                      </Text>
                      <Text variant="bodySmall">{durationStr}</Text>
                    </>
                  )}
                </View>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.primary }}
                >
                  {t("calendar.customTime", {
                    time: `${customStartStr} - ${customEndStr}`,
                  })}
                </Text>
              </>
            )}
          </View>
          {!event.allDay && onCreateAlarm && (
            <IconButton
              icon="alarm-plus"
              size={20}
              onPress={() => onCreateAlarm(event)}
              accessibilityLabel={t("calendar.createAlarm")}
              testID={`event-create-alarm-${event.id}`}
            />
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 4,
  },
  content: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    flex: 1,
  },
  allDayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  allDayTitle: {
    flex: 1,
  },
  allDayLabel: {
    marginLeft: 8,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  realTime: {
    fontVariant: ["tabular-nums"],
  },
  separator: {
    opacity: 0.6,
  },
});

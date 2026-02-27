import React, { useMemo } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { CustomDayTimeline } from "./CustomDayTimeline";
import { EventCard } from "./EventCard";
import type { CalendarEvent } from "../../../models/CalendarEvent";

interface WeekViewProps {
  events: CalendarEvent[];
  selectedDate: number;
  weekStart: number;
  onSelectDate: (dateMs: number) => void;
  onEventPress?: (event: CalendarEvent) => void;
  onCreateAlarm?: (event: CalendarEvent) => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_IN_WEEK = 7;

const WEEKDAY_KEYS = [
  "calendar.weekday.mon",
  "calendar.weekday.tue",
  "calendar.weekday.wed",
  "calendar.weekday.thu",
  "calendar.weekday.fri",
  "calendar.weekday.sat",
  "calendar.weekday.sun",
] as const;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function WeekView({
  events,
  selectedDate,
  weekStart,
  onSelectDate,
  onEventPress,
  onCreateAlarm,
}: WeekViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const today = startOfDay(Date.now());
  const selectedDayStart = startOfDay(selectedDate);

  const days = useMemo(() => {
    const result: number[] = [];
    for (let i = 0; i < DAYS_IN_WEEK; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      result.push(d.getTime());
    }
    return result;
  }, [weekStart]);

  const allDayEvents = useMemo(() => {
    return events.filter(
      (e) =>
        e.allDay &&
        e.startTimestampMs <= selectedDayStart + MS_PER_DAY &&
        e.endTimestampMs > selectedDayStart,
    );
  }, [events, selectedDayStart]);

  const timelineEvents = useMemo(() => {
    return events.filter((e) => {
      if (e.allDay) return false;
      return (
        e.startTimestampMs < selectedDayStart + MS_PER_DAY &&
        e.endTimestampMs > selectedDayStart
      );
    });
  }, [events, selectedDayStart]);

  return (
    <View style={styles.container} testID="week-view">
      <View style={styles.dayHeaders}>
        {days.map((dayMs, i) => {
          const isToday = dayMs === today;
          const isSelected = dayMs === selectedDayStart;
          const date = new Date(dayMs);

          return (
            <TouchableOpacity
              key={dayMs}
              style={[
                styles.dayHeader,
                isSelected && {
                  backgroundColor: theme.colors.primaryContainer,
                  borderRadius: 8,
                },
              ]}
              onPress={() => onSelectDate(dayMs)}
              accessibilityLabel={`${t(WEEKDAY_KEYS[i])} ${date.getDate()}`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                variant="labelSmall"
                style={[
                  { color: theme.colors.onSurfaceVariant },
                  isSelected && {
                    color: theme.colors.onPrimaryContainer,
                  },
                ]}
              >
                {t(WEEKDAY_KEYS[i])}
              </Text>
              <View
                style={[
                  styles.dayNumberContainer,
                  isToday && {
                    backgroundColor: theme.colors.primary,
                    borderRadius: 12,
                  },
                ]}
              >
                <Text
                  variant="bodyMedium"
                  style={[
                    isToday && { color: theme.colors.onPrimary },
                    isSelected &&
                      !isToday && {
                        color: theme.colors.onPrimaryContainer,
                      },
                  ]}
                >
                  {date.getDate()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {allDayEvents.length > 0 && (
        <View style={styles.allDayStrip}>
          {allDayEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onPress={onEventPress}
              onCreateAlarm={onCreateAlarm}
            />
          ))}
        </View>
      )}

      <CustomDayTimeline
        dayStartMs={selectedDayStart}
        events={timelineEvents}
        onEventPress={onEventPress}
        onCreateAlarm={onCreateAlarm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dayHeaders: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dayHeader: {
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    minWidth: 40,
  },
  dayNumberContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  allDayStrip: {
    paddingBottom: 4,
  },
});

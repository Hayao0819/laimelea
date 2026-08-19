import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import type { CalendarEvent } from "../../../models/CalendarEvent";
import {
  addLocalDays,
  intersectsLocalDay,
  startOfLocalDay,
  weekdayOrder,
} from "../services/localDate";
import { CustomDayTimeline } from "./CustomDayTimeline";
import { EventCard } from "./EventCard";

interface WeekViewProps {
  events: CalendarEvent[];
  selectedDate: number;
  weekStart: number;
  firstDayOfWeek?: 0 | 1 | 6;
  onSelectDate: (dateMs: number) => void;
  onEventPress?: (event: CalendarEvent) => void;
  onCreateAlarm?: (event: CalendarEvent) => void;
}

const DAYS_IN_WEEK = 7;

const WEEKDAY_KEYS = [
  "calendar.weekday.sun",
  "calendar.weekday.mon",
  "calendar.weekday.tue",
  "calendar.weekday.wed",
  "calendar.weekday.thu",
  "calendar.weekday.fri",
  "calendar.weekday.sat",
] as const;

export function WeekView({
  events,
  selectedDate,
  weekStart,
  firstDayOfWeek = 1,
  onSelectDate,
  onEventPress,
  onCreateAlarm,
}: WeekViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const today = startOfLocalDay(Date.now());
  const selectedDayStart = startOfLocalDay(selectedDate);

  const days = useMemo(() => {
    const result: number[] = [];
    for (let i = 0; i < DAYS_IN_WEEK; i++) {
      result.push(addLocalDays(weekStart, i));
    }
    return result;
  }, [weekStart]);

  const allDayEvents = useMemo(() => {
    return events.filter(
      (event) =>
        event.allDay &&
        intersectsLocalDay(
          event.startTimestampMs,
          event.endTimestampMs,
          selectedDayStart,
        ),
    );
  }, [events, selectedDayStart]);

  const timelineEvents = useMemo(() => {
    return events.filter((e) => {
      if (e.allDay) return false;
      return intersectsLocalDay(
        e.startTimestampMs,
        e.endTimestampMs,
        selectedDayStart,
      );
    });
  }, [events, selectedDayStart]);
  const orderedWeekdayKeys = useMemo(
    () => weekdayOrder(firstDayOfWeek).map((day) => WEEKDAY_KEYS[day]),
    [firstDayOfWeek],
  );

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
                isSelected && [
                  styles.selectedDayHeader,
                  { backgroundColor: theme.colors.primaryContainer },
                ],
              ]}
              onPress={() => onSelectDate(dayMs)}
              accessibilityLabel={`${t(orderedWeekdayKeys[i])} ${date.getDate()}`}
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
                {t(orderedWeekdayKeys[i])}
              </Text>
              <View
                style={[
                  styles.dayNumberContainer,
                  isToday && [
                    styles.todayDayNumber,
                    { backgroundColor: theme.colors.primary },
                  ],
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  dayHeader: {
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minWidth: 40,
  },
  dayNumberContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  selectedDayHeader: {
    borderRadius: 8,
  },
  todayDayNumber: {
    borderRadius: 12,
  },
  allDayStrip: {
    paddingBottom: spacing.xs,
  },
});

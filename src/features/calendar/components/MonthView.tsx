import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../../../app/spacing";
import type { CalendarEvent } from "../../../models/CalendarEvent";
import {
  addLocalDays,
  intersectsLocalDay,
  startOfLocalDay,
  weekdayOrder,
} from "../services/localDate";
import { EventCard } from "./EventCard";

interface MonthViewProps {
  events: CalendarEvent[];
  selectedDate: number;
  monthStart: number;
  firstDayOfWeek?: 0 | 1 | 6;
  onSelectDate: (dateMs: number) => void;
  onEventPress?: (event: CalendarEvent) => void;
  onCreateAlarm?: (event: CalendarEvent) => void;
}

const DAYS_IN_WEEK = 7;
const MAX_EVENT_DOTS = 3;
const DOT_SIZE = 6;

const WEEKDAY_KEYS = [
  "calendar.weekday.sun",
  "calendar.weekday.mon",
  "calendar.weekday.tue",
  "calendar.weekday.wed",
  "calendar.weekday.thu",
  "calendar.weekday.fri",
  "calendar.weekday.sat",
] as const;

function getEventsForDay(
  events: CalendarEvent[],
  dayMs: number,
): CalendarEvent[] {
  return events.filter((event) =>
    intersectsLocalDay(event.startTimestampMs, event.endTimestampMs, dayMs),
  );
}

interface DayCell {
  dateMs: number;
  date: number;
  isCurrentMonth: boolean;
}

function buildMonthGrid(
  monthStart: number,
  firstDayOfWeek: number,
): DayCell[][] {
  const d = new Date(monthStart);
  const year = d.getFullYear();
  const month = d.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const daysSinceWeekStart =
    (firstDayOfMonth.getDay() - firstDayOfWeek + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const gridStart = new Date(year, month, 1 - daysSinceWeekStart);
  gridStart.setHours(0, 0, 0, 0);

  const weeks: DayCell[][] = [];
  let current = gridStart.getTime();

  for (let w = 0; w < 6; w++) {
    const week: DayCell[] = [];
    for (let di = 0; di < DAYS_IN_WEEK; di++) {
      const cellDate = new Date(current);
      week.push({
        dateMs: current,
        date: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === month,
      });
      current = addLocalDays(current, 1);
    }
    weeks.push(week);
    if (w >= 3) {
      const nextWeekDate = new Date(current);
      if (nextWeekDate.getMonth() !== month) break;
    }
  }

  return weeks;
}

export function MonthView({
  events,
  selectedDate,
  monthStart,
  firstDayOfWeek = 1,
  onSelectDate,
  onEventPress,
  onCreateAlarm,
}: MonthViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const cellSize = Math.floor(
    (width - insets.left - insets.right) / DAYS_IN_WEEK,
  );
  const today = startOfLocalDay(Date.now());
  const selectedDayStart = startOfLocalDay(selectedDate);

  const weeks = useMemo(
    () => buildMonthGrid(monthStart, firstDayOfWeek),
    [firstDayOfWeek, monthStart],
  );
  const orderedWeekdayKeys = useMemo(
    () => weekdayOrder(firstDayOfWeek).map((day) => WEEKDAY_KEYS[day]),
    [firstDayOfWeek],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const week of weeks) {
      for (const cell of week) {
        const dayEvents = getEventsForDay(events, cell.dateMs);
        if (dayEvents.length > 0) {
          map.set(cell.dateMs, dayEvents);
        }
      }
    }
    return map;
  }, [events, weeks]);

  const selectedDayEvents = useMemo(() => {
    return getEventsForDay(events, selectedDayStart).sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return a.startTimestampMs - b.startTimestampMs;
    });
  }, [events, selectedDayStart]);

  return (
    <ScrollView style={styles.container} testID="month-view">
      <View style={styles.weekdayHeader}>
        {orderedWeekdayKeys.map((key) => (
          <View key={key} style={[styles.weekdayCell, { width: cellSize }]}>
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t(key)}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((cell) => {
            const isToday = cell.dateMs === today;
            const isSelected = cell.dateMs === selectedDayStart;
            const cellEvents = eventsByDay.get(cell.dateMs) ?? [];
            const dotEvents = cellEvents.slice(0, MAX_EVENT_DOTS);

            return (
              <TouchableOpacity
                key={cell.dateMs}
                style={[styles.dayCell, { width: cellSize, height: cellSize }]}
                onPress={() => onSelectDate(cell.dateMs)}
                accessibilityLabel={`${new Date(cell.dateMs).getMonth() + 1}/${new Date(cell.dateMs).getDate()}`}
                accessibilityState={{ selected: isSelected }}
              >
                <View
                  style={[
                    styles.dayNumberContainer,
                    isToday && [
                      styles.dayHighlight,
                      { backgroundColor: theme.colors.primary },
                    ],
                    isSelected &&
                      !isToday && [
                        styles.dayHighlight,
                        { backgroundColor: theme.colors.primaryContainer },
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
                      !cell.isCurrentMonth && [
                        styles.disabledText,
                        { color: theme.colors.onSurfaceDisabled },
                      ],
                    ]}
                  >
                    {cell.date}
                  </Text>
                </View>
                <View style={styles.dotRow}>
                  {dotEvents.map((ev, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: ev.colorId ?? theme.colors.primary,
                        },
                      ]}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={styles.eventList}>
        {selectedDayEvents.length === 0 ? (
          <View style={styles.noEvents}>
            <Text variant="bodyLarge">{t("calendar.noEventsForDay")}</Text>
          </View>
        ) : (
          selectedDayEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onPress={onEventPress}
              onCreateAlarm={onCreateAlarm}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  weekdayHeader: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  weekdayCell: {
    alignItems: "center",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  dayCell: {
    alignItems: "center",
    paddingTop: spacing.xs,
  },
  dayNumberContainer: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  dotRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
    height: DOT_SIZE,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  eventList: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.base,
  },
  noEvents: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  dayHighlight: {
    borderRadius: 14,
  },
  disabledText: {
    opacity: 0.5,
  },
});

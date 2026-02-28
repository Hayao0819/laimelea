import React, { useMemo } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { EventCard } from "./EventCard";
import type { CalendarEvent } from "../../../models/CalendarEvent";

interface MonthViewProps {
  events: CalendarEvent[];
  selectedDate: number;
  monthStart: number;
  onSelectDate: (dateMs: number) => void;
  onEventPress?: (event: CalendarEvent) => void;
  onCreateAlarm?: (event: CalendarEvent) => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_IN_WEEK = 7;
const MAX_EVENT_DOTS = 3;
const DOT_SIZE = 6;

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

function isSameDay(ms1: number, ms2: number): boolean {
  const d1 = new Date(ms1);
  const d2 = new Date(ms2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getEventsForDay(
  events: CalendarEvent[],
  dayMs: number,
): CalendarEvent[] {
  return events.filter((e) => {
    if (e.allDay) {
      return (
        e.startTimestampMs <= dayMs + MS_PER_DAY && e.endTimestampMs > dayMs
      );
    }
    return isSameDay(e.startTimestampMs, dayMs);
  });
}

interface DayCell {
  dateMs: number;
  date: number;
  isCurrentMonth: boolean;
}

function buildMonthGrid(monthStart: number): DayCell[][] {
  const d = new Date(monthStart);
  const year = d.getFullYear();
  const month = d.getMonth();

  // Get the day of week for the 1st (ISO: Mon=0, Sun=6)
  const firstDayOfMonth = new Date(year, month, 1);
  const dayOfWeek = firstDayOfMonth.getDay();
  const isoDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Start from the Monday before or on the 1st
  const gridStart = new Date(year, month, 1 - isoDay);
  gridStart.setHours(0, 0, 0, 0);

  const weeks: DayCell[][] = [];
  let current = gridStart.getTime();

  // Build up to 6 weeks
  for (let w = 0; w < 6; w++) {
    const week: DayCell[] = [];
    for (let di = 0; di < DAYS_IN_WEEK; di++) {
      const cellDate = new Date(current);
      week.push({
        dateMs: current,
        date: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === month,
      });
      current += MS_PER_DAY;
    }
    weeks.push(week);
    // Stop if we've passed the current month and filled at least 4 weeks
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
  onSelectDate,
  onEventPress,
  onCreateAlarm,
}: MonthViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const cellSize = Math.floor(width / DAYS_IN_WEEK);
  const today = startOfDay(Date.now());
  const selectedDayStart = startOfDay(selectedDate);

  const weeks = useMemo(() => buildMonthGrid(monthStart), [monthStart]);

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
        {WEEKDAY_KEYS.map((key) => (
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
                          backgroundColor:
                            ev.colorId ?? theme.colors.primary,
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
    paddingVertical: 8,
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
    paddingTop: 4,
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
    paddingTop: 8,
    paddingBottom: 16,
  },
  noEvents: {
    alignItems: "center",
    paddingVertical: 24,
  },
  dayHighlight: {
    borderRadius: 14,
  },
  disabledText: {
    opacity: 0.5,
  },
});

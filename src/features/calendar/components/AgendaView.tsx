import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View, SectionList, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { spacing } from "../../../app/spacing";
import { EventCard } from "./EventCard";
import type { CalendarEvent } from "../../../models/CalendarEvent";

interface AgendaViewProps {
  events: CalendarEvent[];
  selectedDate: number;
  onSelectDate: (dateMs: number) => void;
  onEventPress?: (event: CalendarEvent) => void;
  onCreateAlarm?: (event: CalendarEvent) => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const AGENDA_RANGE_DAYS = 14;

const WEEKDAY_KEYS = [
  "calendar.weekday.sun",
  "calendar.weekday.mon",
  "calendar.weekday.tue",
  "calendar.weekday.wed",
  "calendar.weekday.thu",
  "calendar.weekday.fri",
  "calendar.weekday.sat",
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

interface AgendaSection {
  dateMs: number;
  title: string;
  isToday: boolean;
  data: CalendarEvent[];
}

export function AgendaView({
  events,
  selectedDate,
  onEventPress,
  onCreateAlarm,
}: AgendaViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const sectionListRef =
    useRef<SectionList<CalendarEvent, AgendaSection>>(null);

  const today = startOfDay(Date.now());
  const selectedDayStart = startOfDay(selectedDate);

  const sections = useMemo(() => {
    const result: AgendaSection[] = [];

    for (let i = -AGENDA_RANGE_DAYS; i <= AGENDA_RANGE_DAYS; i++) {
      const d = new Date(selectedDayStart);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const dayMs = d.getTime();
      const dayEnd = dayMs + MS_PER_DAY;

      const dayEvents = events
        .filter((e) => {
          if (e.allDay) {
            return e.startTimestampMs <= dayEnd && e.endTimestampMs > dayMs;
          }
          return isSameDay(e.startTimestampMs, dayMs);
        })
        .sort((a, b) => {
          if (a.allDay && !b.allDay) return -1;
          if (!a.allDay && b.allDay) return 1;
          return a.startTimestampMs - b.startTimestampMs;
        });

      if (dayEvents.length === 0) continue;

      const date = new Date(dayMs);
      const month = date.getMonth();
      const day = date.getDate();
      const weekday = date.getDay();
      const isDayToday = dayMs === today;

      const monthName = t(`calendar.monthNames.${month}`);
      const weekdayName = t(WEEKDAY_KEYS[weekday]);
      const titleStr = isDayToday
        ? `${monthName} ${day} ${weekdayName} (${t("calendar.today")})`
        : `${monthName} ${day} ${weekdayName}`;

      result.push({
        dateMs: dayMs,
        title: titleStr,
        isToday: isDayToday,
        data: dayEvents,
      });
    }

    return result;
  }, [events, selectedDayStart, today, t]);

  const selectedSectionIndex = useMemo(() => {
    // Find the section closest to the selected date
    let closest = 0;
    let minDiff = Infinity;
    for (let i = 0; i < sections.length; i++) {
      const diff = Math.abs(sections[i].dateMs - selectedDayStart);
      if (diff < minDiff) {
        minDiff = diff;
        closest = i;
      }
    }
    return closest;
  }, [sections, selectedDayStart]);

  useEffect(() => {
    if (
      sectionListRef.current &&
      sections.length > 0 &&
      selectedSectionIndex < sections.length
    ) {
      const timer = setTimeout(() => {
        try {
          sectionListRef.current?.scrollToLocation({
            sectionIndex: selectedSectionIndex,
            itemIndex: 0,
            animated: false,
            viewOffset: 0,
          });
        } catch {
          // scrollToLocation can throw if layout isn't ready
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedSectionIndex, sections.length]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: AgendaSection }) => (
      <View
        style={[
          styles.sectionHeader,
          { backgroundColor: theme.colors.surface },
          section.isToday && {
            backgroundColor: theme.colors.primaryContainer,
          },
        ]}
      >
        <Text
          variant="titleSmall"
          style={[
            { color: theme.colors.onSurface },
            section.isToday && {
              color: theme.colors.onPrimaryContainer,
            },
          ]}
        >
          {section.title}
        </Text>
      </View>
    ),
    [theme],
  );

  const renderItem = useCallback(
    ({ item }: { item: CalendarEvent }) => (
      <EventCard
        event={item}
        onPress={onEventPress}
        onCreateAlarm={onCreateAlarm}
      />
    ),
    [onEventPress, onCreateAlarm],
  );

  const keyExtractor = useCallback(
    (item: CalendarEvent, index: number) => `${item.id}-${index}`,
    [],
  );

  return (
    <SectionList
      ref={sectionListRef}
      sections={sections}
      renderSectionHeader={renderSectionHeader}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      stickySectionHeadersEnabled
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.emptyList}>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("calendar.noEventsForDay")}
          </Text>
        </View>
      }
      testID="agenda-view"
      initialNumToRender={60}
      getItemLayout={undefined}
      onScrollToIndexFailed={() => {
        // Silently handle scroll failures
      }}
    />
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  emptyList: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  listContent: {
    paddingBottom: spacing.base,
  },
});

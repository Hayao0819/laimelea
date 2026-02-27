import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useAtomValue } from "jotai";
import { cycleConfigAtom } from "../../../atoms/settingsAtoms";
import { realToCustom } from "../../../core/time/conversions";
import { formatCustomTimeShort } from "../../../core/time/formatting";
import type { CalendarEvent } from "../../../models/CalendarEvent";
import { NowIndicator } from "./NowIndicator";
import { TimelineEventBlock } from "./TimelineEventBlock";

const HOURS_IN_DAY = 24;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = HOURS_IN_DAY * MS_PER_HOUR;
const MS_PER_MINUTE = 60 * 1000;
const MIN_HOUR_HEIGHT = 30;
const LEFT_LABEL_WIDTH = 50;
const RIGHT_LABEL_WIDTH = 50;
const HOUR_LABEL_HEIGHT = 16;
const NOW_UPDATE_INTERVAL_MS = 60 * 1000;

interface CustomDayTimelineProps {
  dayStartMs: number;
  events: CalendarEvent[];
  hourHeight?: number;
  onEventPress?: (event: CalendarEvent) => void;
  onCreateAlarm?: (event: CalendarEvent) => void;
}

// --- Overlap computation (exported for testing) ---

export interface OverlapGroup {
  events: CalendarEvent[];
  columns: number;
  columnAssignments: Map<string, number>;
}

export function computeOverlapGroups(events: CalendarEvent[]): OverlapGroup[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => a.startTimestampMs - b.startTimestampMs,
  );

  const groups: OverlapGroup[] = [];
  let currentGroup: CalendarEvent[] = [sorted[0]];
  let groupEnd = sorted[0].endTimestampMs;

  for (let i = 1; i < sorted.length; i++) {
    const ev = sorted[i];
    if (ev.startTimestampMs < groupEnd) {
      // Overlaps with current group
      currentGroup.push(ev);
      groupEnd = Math.max(groupEnd, ev.endTimestampMs);
    } else {
      // No overlap; finalize current group and start a new one
      groups.push(assignColumns(currentGroup));
      currentGroup = [ev];
      groupEnd = ev.endTimestampMs;
    }
  }
  groups.push(assignColumns(currentGroup));

  return groups;
}

function assignColumns(events: CalendarEvent[]): OverlapGroup {
  const sorted = [...events].sort(
    (a, b) => a.startTimestampMs - b.startTimestampMs,
  );

  const columnAssignments = new Map<string, number>();
  // Track end time for each column to assign events greedily
  const columnEnds: number[] = [];

  for (const ev of sorted) {
    let placed = false;
    for (let col = 0; col < columnEnds.length; col++) {
      if (columnEnds[col] <= ev.startTimestampMs) {
        columnAssignments.set(ev.id, col);
        columnEnds[col] = ev.endTimestampMs;
        placed = true;
        break;
      }
    }
    if (!placed) {
      const col = columnEnds.length;
      columnAssignments.set(ev.id, col);
      columnEnds.push(ev.endTimestampMs);
    }
  }

  return {
    events: sorted,
    columns: columnEnds.length,
    columnAssignments,
  };
}

// --- Helper functions ---

function isToday(dayStartMs: number): boolean {
  const now = new Date();
  const dayStart = new Date(dayStartMs);
  return (
    now.getFullYear() === dayStart.getFullYear() &&
    now.getMonth() === dayStart.getMonth() &&
    now.getDate() === dayStart.getDate()
  );
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function clampToDay(event: CalendarEvent, dayStartMs: number): CalendarEvent {
  const dayEndMs = dayStartMs + MS_PER_DAY;
  return {
    ...event,
    startTimestampMs: Math.max(event.startTimestampMs, dayStartMs),
    endTimestampMs: Math.min(event.endTimestampMs, dayEndMs),
  };
}

// --- Component ---

export function CustomDayTimeline({
  dayStartMs,
  events,
  hourHeight: hourHeightProp = 60,
  onEventPress,
}: CustomDayTimelineProps) {
  const theme = useTheme();
  const cycleConfig = useAtomValue(cycleConfigAtom);
  const scrollRef = useRef<ScrollView>(null);

  const hourHeight = Math.max(hourHeightProp, MIN_HOUR_HEIGHT);
  const totalHeight = HOURS_IN_DAY * hourHeight;

  const [now, setNow] = useState(Date.now());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, NOW_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const showNowIndicator = isToday(dayStartMs);

  const nowOffset = useMemo(() => {
    if (!showNowIndicator) return 0;
    const minutesSinceMidnight = (now - dayStartMs) / MS_PER_MINUTE;
    return (minutesSinceMidnight / 60) * hourHeight;
  }, [now, dayStartMs, hourHeight, showNowIndicator]);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (showNowIndicator && scrollRef.current) {
      // Scroll to 1 hour before current time so the indicator is visible
      const scrollY = Math.max(0, nowOffset - hourHeight);
      // Use setTimeout to ensure ScrollView is fully laid out
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: scrollY, animated: false });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showNowIndicator]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter and clamp events to this day
  const dayEndMs = dayStartMs + MS_PER_DAY;
  const dayEvents = useMemo(() => {
    return events
      .filter(
        (e) =>
          !e.allDay &&
          e.startTimestampMs < dayEndMs &&
          e.endTimestampMs > dayStartMs,
      )
      .map((e) => clampToDay(e, dayStartMs));
  }, [events, dayStartMs, dayEndMs]);

  // Compute overlap groups
  const overlapGroups = useMemo(
    () => computeOverlapGroups(dayEvents),
    [dayEvents],
  );

  // Hour lines data
  const hourLines = useMemo(() => {
    const lines = [];
    for (let h = 0; h < HOURS_IN_DAY; h++) {
      const realMs = dayStartMs + h * MS_PER_HOUR;
      const customTime = realToCustom(realMs, cycleConfig);
      lines.push({
        hour: h,
        realLabel: formatHourLabel(h),
        customLabel: formatCustomTimeShort(customTime),
        top: h * hourHeight,
      });
    }
    return lines;
  }, [dayStartMs, hourHeight, cycleConfig]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scrollView}
      contentContainerStyle={{ height: totalHeight }}
      showsVerticalScrollIndicator
      testID="custom-day-timeline"
    >
      <View style={styles.timelineContainer}>
        {/* Hour lines and labels */}
        {hourLines.map((line) => (
          <View key={line.hour} style={[styles.hourRow, { top: line.top }]}>
            <Text
              variant="labelSmall"
              style={[
                styles.leftLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {line.realLabel}
            </Text>
            <View
              style={[
                styles.hourLine,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />
            <Text
              variant="labelSmall"
              style={[styles.rightLabel, { color: theme.colors.primary }]}
              numberOfLines={1}
            >
              {line.customLabel}
            </Text>
          </View>
        ))}

        {/* Event blocks */}
        <View
          style={[
            styles.eventArea,
            {
              left: LEFT_LABEL_WIDTH,
              right: RIGHT_LABEL_WIDTH,
            },
          ]}
        >
          {overlapGroups.map((group) =>
            group.events.map((event) => {
              const col = group.columnAssignments.get(event.id) ?? 0;
              const widthRatio = 1 / group.columns;
              const startMinutes =
                (event.startTimestampMs - dayStartMs) / MS_PER_MINUTE;
              const endMinutes =
                (event.endTimestampMs - dayStartMs) / MS_PER_MINUTE;
              const top = (startMinutes / 60) * hourHeight;
              const blockHeight =
                ((endMinutes - startMinutes) / 60) * hourHeight;
              const eventColor = event.colorId ?? theme.colors.primary;

              return (
                <TimelineEventBlock
                  key={event.id}
                  event={event}
                  topOffset={top}
                  height={blockHeight}
                  leftOffset={col * widthRatio}
                  widthRatio={widthRatio}
                  color={eventColor}
                  onPress={onEventPress}
                />
              );
            }),
          )}
        </View>

        {/* Now indicator */}
        {showNowIndicator && (
          <View
            style={[
              styles.nowIndicatorContainer,
              {
                left: LEFT_LABEL_WIDTH,
                right: RIGHT_LABEL_WIDTH,
              },
            ]}
          >
            <NowIndicator topOffset={nowOffset} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  timelineContainer: {
    position: "relative",
    flex: 1,
  },
  hourRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    height: HOUR_LABEL_HEIGHT,
  },
  leftLabel: {
    width: LEFT_LABEL_WIDTH,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  hourLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  rightLabel: {
    width: RIGHT_LABEL_WIDTH,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  eventArea: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  nowIndicatorContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
});

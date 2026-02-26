import React, { useCallback, useRef, useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Chip, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

const DAY_RANGE = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ITEM_WIDTH = 72;

interface DaySelectorProps {
  selectedDate: number;
  onSelectDate: (dateMs: number) => void;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDayLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatWeekday(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export function DaySelector({ selectedDate, onSelectDate }: DaySelectorProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const listRef = useRef<FlatList>(null);

  const today = startOfDay(Date.now());

  const days = useMemo(() => {
    const result: number[] = [];
    for (let i = -DAY_RANGE; i <= DAY_RANGE; i++) {
      result.push(today + i * MS_PER_DAY);
    }
    return result;
  }, [today]);

  const todayIndex = DAY_RANGE; // center of the array

  const handleScrollToToday = useCallback(() => {
    listRef.current?.scrollToIndex({ index: todayIndex, animated: true });
    onSelectDate(today);
  }, [today, todayIndex, onSelectDate]);

  const renderItem = useCallback(
    ({ item }: { item: number }) => {
      const isSelected = startOfDay(selectedDate) === item;
      const isToday = item === today;
      const label = isToday ? t("calendar.today") : formatDayLabel(item);

      return (
        <View style={styles.chipContainer}>
          <Chip
            selected={isSelected}
            onPress={() => onSelectDate(item)}
            style={[
              styles.chip,
              isSelected && {
                backgroundColor: theme.colors.primaryContainer,
              },
            ]}
            textStyle={
              isSelected
                ? { color: theme.colors.onPrimaryContainer }
                : undefined
            }
            compact
          >
            {label}
          </Chip>
          <Chip
            style={styles.weekdayChip}
            textStyle={styles.weekdayText}
            compact
            disabled
          >
            {formatWeekday(item)}
          </Chip>
        </View>
      );
    },
    [selectedDate, today, theme, t, onSelectDate],
  );

  const keyExtractor = useCallback((item: number) => String(item), []);

  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: ITEM_WIDTH,
      offset: ITEM_WIDTH * index,
      index,
    }),
    [],
  );

  return (
    <View>
      <FlatList
        ref={listRef}
        data={days}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        getItemLayout={getItemLayout}
        initialScrollIndex={todayIndex}
        contentContainerStyle={styles.listContent}
        testID="day-selector"
      />
      <Chip
        icon="calendar-today"
        onPress={handleScrollToToday}
        style={styles.todayButton}
        compact
      >
        {t("calendar.today")}
      </Chip>
    </View>
  );
}

const styles = StyleSheet.create({
  chipContainer: {
    width: ITEM_WIDTH,
    alignItems: "center",
    paddingVertical: 4,
  },
  chip: {
    marginHorizontal: 2,
  },
  weekdayChip: {
    backgroundColor: "transparent",
    marginTop: 2,
  },
  weekdayText: {
    fontSize: 10,
  },
  listContent: {
    paddingHorizontal: 8,
  },
  todayButton: {
    alignSelf: "center",
    marginVertical: 4,
  },
});

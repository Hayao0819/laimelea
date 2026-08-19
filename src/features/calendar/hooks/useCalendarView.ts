import { useAtom, useAtomValue } from "jotai";
import { useCallback, useMemo } from "react";

import type { CalendarViewMode } from "../../../atoms/calendarAtoms";
import {
  calendarSelectedDateAtom,
  calendarViewModeAtom,
} from "../../../atoms/calendarAtoms";
import { resolvedSettingsAtom } from "../../../atoms/settingsAtoms";
import {
  addLocalDays,
  endOfLocalDay,
  startOfLocalDay,
  startOfLocalWeek,
} from "../services/localDate";

export interface CalendarViewState {
  viewMode: CalendarViewMode;
  setViewMode: (mode: CalendarViewMode) => void;
  selectedDate: number;
  setSelectedDate: (dateMs: number) => void;
  selectedDayStart: number;
  selectedDayEnd: number;
  weekStart: number;
  monthStart: number;
  goToToday: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
}

function getFirstOfMonth(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

export function useCalendarView(): CalendarViewState {
  const [viewMode, setViewMode] = useAtom(calendarViewModeAtom);
  const [selectedDate, setSelectedDate] = useAtom(calendarSelectedDateAtom);
  const { calendarFirstDayOfWeek } = useAtomValue(resolvedSettingsAtom);

  const selectedDayStart = useMemo(
    () => startOfLocalDay(selectedDate),
    [selectedDate],
  );
  const selectedDayEnd = useMemo(
    () => endOfLocalDay(selectedDate),
    [selectedDate],
  );
  const weekStart = useMemo(
    () => startOfLocalWeek(selectedDate, calendarFirstDayOfWeek),
    [calendarFirstDayOfWeek, selectedDate],
  );
  const monthStart = useMemo(
    () => getFirstOfMonth(selectedDate),
    [selectedDate],
  );

  const goToToday = useCallback(() => {
    setSelectedDate(startOfLocalDay(Date.now()));
  }, [setSelectedDate]);

  const goToPrevious = useCallback(() => {
    const d = new Date(selectedDate);
    switch (viewMode) {
      case "month": {
        d.setDate(1);
        d.setMonth(d.getMonth() - 1);
        setSelectedDate(d.getTime());
        break;
      }
      case "week": {
        setSelectedDate(addLocalDays(d.getTime(), -7));
        break;
      }
      case "agenda": {
        setSelectedDate(addLocalDays(d.getTime(), -1));
        break;
      }
    }
  }, [selectedDate, viewMode, setSelectedDate]);

  const goToNext = useCallback(() => {
    const d = new Date(selectedDate);
    switch (viewMode) {
      case "month": {
        d.setDate(1);
        d.setMonth(d.getMonth() + 1);
        setSelectedDate(d.getTime());
        break;
      }
      case "week": {
        setSelectedDate(addLocalDays(d.getTime(), 7));
        break;
      }
      case "agenda": {
        setSelectedDate(addLocalDays(d.getTime(), 1));
        break;
      }
    }
  }, [selectedDate, viewMode, setSelectedDate]);

  return {
    viewMode,
    setViewMode,
    selectedDate,
    setSelectedDate,
    selectedDayStart,
    selectedDayEnd,
    weekStart,
    monthStart,
    goToToday,
    goToPrevious,
    goToNext,
  };
}

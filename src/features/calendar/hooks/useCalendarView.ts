import { useCallback, useMemo } from "react";
import { useAtom } from "jotai";
import {
  calendarViewModeAtom,
  calendarSelectedDateAtom,
} from "../../../atoms/calendarAtoms";
import type { CalendarViewMode } from "../../../atoms/calendarAtoms";

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

function getStartOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getEndOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

function getMondayOfWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // ISO 8601: Monday is first day. Sunday (0) becomes 6, others shift by -1.
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.getTime();
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

  const selectedDayStart = useMemo(
    () => getStartOfDay(selectedDate),
    [selectedDate],
  );
  const selectedDayEnd = useMemo(
    () => getEndOfDay(selectedDate),
    [selectedDate],
  );
  const weekStart = useMemo(
    () => getMondayOfWeek(selectedDate),
    [selectedDate],
  );
  const monthStart = useMemo(
    () => getFirstOfMonth(selectedDate),
    [selectedDate],
  );

  const goToToday = useCallback(() => {
    setSelectedDate(getStartOfDay(Date.now()));
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
        d.setDate(d.getDate() - 7);
        setSelectedDate(d.getTime());
        break;
      }
      case "agenda": {
        d.setDate(d.getDate() - 1);
        setSelectedDate(d.getTime());
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
        d.setDate(d.getDate() + 7);
        setSelectedDate(d.getTime());
        break;
      }
      case "agenda": {
        d.setDate(d.getDate() + 1);
        setSelectedDate(d.getTime());
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

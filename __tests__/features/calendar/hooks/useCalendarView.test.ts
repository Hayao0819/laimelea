import { act, renderHook } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";

import {
  calendarSelectedDateAtom,
  calendarViewModeAtom,
} from "../../../../src/atoms/calendarAtoms";
import { useCalendarView } from "../../../../src/features/calendar/hooks/useCalendarView";

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function renderCalendarViewHook(initialDate?: number, initialMode?: string) {
  const store = createStore();
  if (initialDate != null) {
    store.set(calendarSelectedDateAtom, initialDate);
  }
  if (initialMode != null) {
    store.set(calendarViewModeAtom, initialMode as "month" | "week" | "agenda");
  }
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(JotaiProvider, { store }, children);
  }
  return {
    ...renderHook(() => useCalendarView(), { wrapper: Wrapper }),
    store,
  };
}

describe("useCalendarView", () => {
  describe("viewMode", () => {
    it("defaults to agenda", () => {
      const { result } = renderCalendarViewHook();
      expect(result.current.viewMode).toBe("agenda");
    });

    it("can switch to month/week/agenda", async () => {
      const { result } = renderCalendarViewHook();

      await act(() => {
        result.current.setViewMode("month");
      });
      expect(result.current.viewMode).toBe("month");

      await act(() => {
        result.current.setViewMode("week");
      });
      expect(result.current.viewMode).toBe("week");

      await act(() => {
        result.current.setViewMode("agenda");
      });
      expect(result.current.viewMode).toBe("agenda");
    });
  });

  describe("selectedDate", () => {
    it("defaults to start of today", () => {
      const { result } = renderCalendarViewHook();
      const todayStart = startOfDay(Date.now());
      expect(result.current.selectedDate).toBe(todayStart);
    });

    it("updates when setSelectedDate is called", async () => {
      const { result } = renderCalendarViewHook();
      // 2025-06-15 00:00:00 local time
      const targetDate = new Date(2025, 5, 15, 0, 0, 0, 0).getTime();

      await act(() => {
        result.current.setSelectedDate(targetDate);
      });

      expect(result.current.selectedDate).toBe(targetDate);
    });
  });

  describe("computed values", () => {
    it("selectedDayStart is midnight of selected date", () => {
      // Set to 2025-03-15 14:30:00 (mid-afternoon)
      const dateWithTime = new Date(2025, 2, 15, 14, 30, 0, 0).getTime();
      const { result } = renderCalendarViewHook(dateWithTime);

      const expected = new Date(2025, 2, 15, 0, 0, 0, 0).getTime();
      expect(result.current.selectedDayStart).toBe(expected);
    });

    it("selectedDayEnd is midnight of next day", () => {
      const dateWithTime = new Date(2025, 2, 15, 14, 30, 0, 0).getTime();
      const { result } = renderCalendarViewHook(dateWithTime);

      const expected = new Date(2025, 2, 16, 0, 0, 0, 0).getTime();
      expect(result.current.selectedDayEnd).toBe(expected);
    });

    it("weekStart is Monday of the selected week", () => {
      // 2025-03-12 is a Wednesday
      const wednesday = new Date(2025, 2, 12, 0, 0, 0, 0).getTime();
      const { result } = renderCalendarViewHook(wednesday);

      // Monday of that week is 2025-03-10
      const expectedMonday = new Date(2025, 2, 10, 0, 0, 0, 0).getTime();
      expect(result.current.weekStart).toBe(expectedMonday);
    });

    it("weekStart handles Sunday correctly (maps to previous Monday)", () => {
      // 2025-03-16 is a Sunday
      const sunday = new Date(2025, 2, 16, 0, 0, 0, 0).getTime();
      const { result } = renderCalendarViewHook(sunday);

      // Monday of that week (ISO 8601) is 2025-03-10
      const expectedMonday = new Date(2025, 2, 10, 0, 0, 0, 0).getTime();
      expect(result.current.weekStart).toBe(expectedMonday);
    });

    it("monthStart is 1st of the selected month", () => {
      const midMonth = new Date(2025, 7, 20, 0, 0, 0, 0).getTime();
      const { result } = renderCalendarViewHook(midMonth);

      const expected = new Date(2025, 7, 1, 0, 0, 0, 0).getTime();
      expect(result.current.monthStart).toBe(expected);
    });
  });

  describe("goToToday", () => {
    it("resets selectedDate to today start", async () => {
      // Start on a different date
      const pastDate = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const { result } = renderCalendarViewHook(pastDate);

      expect(result.current.selectedDate).toBe(pastDate);

      await act(() => {
        result.current.goToToday();
      });

      const todayStart = startOfDay(Date.now());
      expect(result.current.selectedDate).toBe(todayStart);
    });
  });

  describe("goToPrevious", () => {
    it("moves back 1 month in month mode", async () => {
      // 2025-06-15
      const june15 = new Date(2025, 5, 15, 0, 0, 0, 0).getTime();
      const { result } = renderCalendarViewHook(june15, "month");

      await act(() => {
        result.current.goToPrevious();
      });

      // Should move to May 1 (goToPrevious sets date to 1 first, then subtracts month)
      const expected = new Date(2025, 4, 1, 0, 0, 0, 0).getTime();
      expect(result.current.selectedDate).toBe(expected);
    });

    it("moves back 7 days in week mode", async () => {
      // 2025-03-15 (Saturday)
      const march15 = new Date(2025, 2, 15, 0, 0, 0, 0).getTime();
      const { result } = renderCalendarViewHook(march15, "week");

      await act(() => {
        result.current.goToPrevious();
      });

      const expected = new Date(2025, 2, 8, 0, 0, 0, 0).getTime();
      expect(result.current.selectedDate).toBe(expected);
    });

    it("moves back 1 day in agenda mode", async () => {
      const march15 = new Date(2025, 2, 15, 0, 0, 0, 0).getTime();
      const { result } = renderCalendarViewHook(march15, "agenda");

      await act(() => {
        result.current.goToPrevious();
      });

      const expected = new Date(2025, 2, 14, 0, 0, 0, 0).getTime();
      expect(result.current.selectedDate).toBe(expected);
    });

    it("handles month boundary correctly (March -> February)", async () => {
      // 2025-03-01
      const march1 = new Date(2025, 2, 1, 0, 0, 0, 0).getTime();
      const { result } = renderCalendarViewHook(march1, "month");

      await act(() => {
        result.current.goToPrevious();
      });

      // setDate(1) then setMonth(month-1) => Feb 1
      const expected = new Date(2025, 1, 1, 0, 0, 0, 0).getTime();
      expect(result.current.selectedDate).toBe(expected);
    });
  });

  describe("goToNext", () => {
    it("moves forward 1 month in month mode", async () => {
      // 2025-06-15
      const june15 = new Date(2025, 5, 15, 0, 0, 0, 0).getTime();
      const { result } = renderCalendarViewHook(june15, "month");

      await act(() => {
        result.current.goToNext();
      });

      // setDate(1) then setMonth(month+1) => July 1
      const expected = new Date(2025, 6, 1, 0, 0, 0, 0).getTime();
      expect(result.current.selectedDate).toBe(expected);
    });

    it("moves forward 7 days in week mode", async () => {
      const march15 = new Date(2025, 2, 15, 0, 0, 0, 0).getTime();
      const { result } = renderCalendarViewHook(march15, "week");

      await act(() => {
        result.current.goToNext();
      });

      const expected = new Date(2025, 2, 22, 0, 0, 0, 0).getTime();
      expect(result.current.selectedDate).toBe(expected);
    });

    it("moves forward 1 day in agenda mode", async () => {
      const march15 = new Date(2025, 2, 15, 0, 0, 0, 0).getTime();
      const { result } = renderCalendarViewHook(march15, "agenda");

      await act(() => {
        result.current.goToNext();
      });

      const expected = new Date(2025, 2, 16, 0, 0, 0, 0).getTime();
      expect(result.current.selectedDate).toBe(expected);
    });

    it("handles year boundary correctly (December -> January)", async () => {
      // 2025-12-15
      const dec15 = new Date(2025, 11, 15, 0, 0, 0, 0).getTime();
      const { result } = renderCalendarViewHook(dec15, "month");

      await act(() => {
        result.current.goToNext();
      });

      // setDate(1) then setMonth(month+1) => Jan 1, 2026
      const expected = new Date(2026, 0, 1, 0, 0, 0, 0).getTime();
      expect(result.current.selectedDate).toBe(expected);
    });
  });
});

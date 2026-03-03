import { fireEvent, render } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { MonthView } from "../../../../src/features/calendar/components/MonthView";
import type { CalendarEvent } from "../../../../src/models/CalendarEvent";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
    },
  };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) return `${key}:${JSON.stringify(opts)}`;
      return key;
    },
    i18n: { language: "en" },
  }),
}));

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Use a fixed date for reproducible tests: August 15, 2026 (a Saturday)
// August 2026 starts on Saturday -> produces 6 weeks (42 cells)
const FIXED_NOW = new Date(2026, 7, 15, 12, 0, 0).getTime();
const TODAY = startOfDay(FIXED_NOW);

// monthStart = August 1, 2026
const MONTH_START = new Date(2026, 7, 1, 0, 0, 0, 0).getTime();

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    sourceEventId: "src-1",
    source: "google",
    title: "Morning Meeting",
    description: "",
    startTimestampMs: TODAY + 10 * 60 * 60 * 1000, // 10:00
    endTimestampMs: TODAY + 11 * 60 * 60 * 1000, // 11:00
    allDay: false,
    colorId: "#4285F4",
    calendarName: "Work",
    calendarId: "work-1",
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement, store = createStore()) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>{ui}</PaperProvider>
    </JotaiProvider>,
  );
  return { ...utils, store };
}

describe("MonthView", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders with testID", async () => {
    const { getByTestId } = await renderWithProviders(
      <MonthView
        events={[]}
        selectedDate={TODAY}
        monthStart={MONTH_START}
        onSelectDate={jest.fn()}
      />,
    );
    expect(getByTestId("month-view")).toBeTruthy();
  });

  it("renders weekday headers (Mon-Sun)", async () => {
    const { getByText } = await renderWithProviders(
      <MonthView
        events={[]}
        selectedDate={TODAY}
        monthStart={MONTH_START}
        onSelectDate={jest.fn()}
      />,
    );

    const weekdayKeys = [
      "calendar.weekday.mon",
      "calendar.weekday.tue",
      "calendar.weekday.wed",
      "calendar.weekday.thu",
      "calendar.weekday.fri",
      "calendar.weekday.sat",
      "calendar.weekday.sun",
    ];
    for (const key of weekdayKeys) {
      expect(getByText(key)).toBeTruthy();
    }
  });

  it("renders correct number of day cells (6 weeks x 7 = 42)", async () => {
    // August 2026 starts on Saturday (isoDay=5), has 31 days -> 6 weeks
    const { getAllByLabelText } = await renderWithProviders(
      <MonthView
        events={[]}
        selectedDate={TODAY}
        monthStart={MONTH_START}
        onSelectDate={jest.fn()}
      />,
    );

    // Each day cell has accessibilityLabel in "M/D" format
    const dayCells = getAllByLabelText(/^\d{1,2}\/\d{1,2}$/);
    expect(dayCells).toHaveLength(42);
  });

  it("highlights today with primary color", async () => {
    const { toJSON } = await renderWithProviders(
      <MonthView
        events={[]}
        selectedDate={TODAY - MS_PER_DAY} // select a different day so today styling is isolated
        monthStart={MONTH_START}
        onSelectDate={jest.fn()}
      />,
    );

    const tree = toJSON();

    // Today (Aug 15) should have a container with backgroundColor = primary and borderRadius 14
    function flattenStyles(style: unknown): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      if (Array.isArray(style)) {
        for (const s of style) {
          Object.assign(result, flattenStyles(s));
        }
      } else if (style && typeof style === "object") {
        Object.assign(result, style);
      }
      return result;
    }

    function findTodayHighlight(node: ReturnType<typeof toJSON>): boolean {
      if (!node || typeof node === "string") return false;
      if (Array.isArray(node)) return node.some((n) => findTodayHighlight(n));
      const merged = flattenStyles(node.props?.style);
      if (merged.backgroundColor && merged.borderRadius === 14) {
        if (node.children) {
          for (const child of node.children) {
            if (
              child &&
              typeof child !== "string" &&
              !Array.isArray(child) &&
              child.children?.includes("15")
            ) {
              return true;
            }
          }
        }
      }
      if (node.children) {
        for (const child of node.children) {
          if (findTodayHighlight(child as ReturnType<typeof toJSON>)) {
            return true;
          }
        }
      }
      return false;
    }

    expect(findTodayHighlight(tree)).toBe(true);
  });

  it("highlights selected date", async () => {
    // Select Aug 20 (not today)
    const selectedDate = new Date(2026, 7, 20, 0, 0, 0, 0).getTime();

    const { toJSON } = await renderWithProviders(
      <MonthView
        events={[]}
        selectedDate={selectedDate}
        monthStart={MONTH_START}
        onSelectDate={jest.fn()}
      />,
    );

    const tree = toJSON();

    // Selected date (Aug 20, not today) should have primaryContainer bg + borderRadius 14
    function flattenStyles(style: unknown): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      if (Array.isArray(style)) {
        for (const s of style) {
          Object.assign(result, flattenStyles(s));
        }
      } else if (style && typeof style === "object") {
        Object.assign(result, style);
      }
      return result;
    }

    function findSelectedHighlight(node: ReturnType<typeof toJSON>): boolean {
      if (!node || typeof node === "string") return false;
      if (Array.isArray(node))
        return node.some((n) => findSelectedHighlight(n));
      const merged = flattenStyles(node.props?.style);
      if (merged.borderRadius === 14 && merged.backgroundColor) {
        if (node.children) {
          for (const child of node.children) {
            if (
              child &&
              typeof child !== "string" &&
              !Array.isArray(child) &&
              child.children?.includes("20")
            ) {
              return true;
            }
          }
        }
      }
      if (node.children) {
        for (const child of node.children) {
          if (findSelectedHighlight(child as ReturnType<typeof toJSON>)) {
            return true;
          }
        }
      }
      return false;
    }

    expect(findSelectedHighlight(tree)).toBe(true);
  });

  it("dims previous/next month dates", async () => {
    const { toJSON } = await renderWithProviders(
      <MonthView
        events={[]}
        selectedDate={TODAY}
        monthStart={MONTH_START}
        onSelectDate={jest.fn()}
      />,
    );

    const tree = toJSON();

    // Previous/next month cells have opacity: 0.5 on their text
    // Styles can be deeply nested arrays (react-native-paper wraps styles)
    function flattenStyles(style: unknown): Record<string, unknown>[] {
      if (!style) return [];
      if (Array.isArray(style)) return style.flatMap(flattenStyles);
      if (typeof style === "object") return [style as Record<string, unknown>];
      return [];
    }

    function findDimmedText(node: ReturnType<typeof toJSON>): boolean {
      if (!node || typeof node === "string") return false;
      if (Array.isArray(node)) return node.some((n) => findDimmedText(n));
      const flatStyles = flattenStyles(node.props?.style);
      for (const s of flatStyles) {
        if (s.opacity === 0.5) {
          return true;
        }
      }
      if (node.children) {
        for (const child of node.children) {
          if (findDimmedText(child as ReturnType<typeof toJSON>)) {
            return true;
          }
        }
      }
      return false;
    }

    // August 2026 grid starts on July 27 (Mon), so there are dimmed cells
    expect(findDimmedText(tree)).toBe(true);
  });

  it("calls onSelectDate when a day cell is pressed", async () => {
    const onSelectDate = jest.fn();

    const { getByLabelText } = await renderWithProviders(
      <MonthView
        events={[]}
        selectedDate={TODAY}
        monthStart={MONTH_START}
        onSelectDate={onSelectDate}
      />,
    );

    // Press Aug 20 cell via accessibility label "8/20"
    await fireEvent.press(getByLabelText("8/20"));

    const aug20 = new Date(2026, 7, 20, 0, 0, 0, 0).getTime();
    expect(onSelectDate).toHaveBeenCalledWith(aug20);
  });

  it("shows event dots for days with events (max 3)", async () => {
    // Create 4 events on the same day -- only 3 dots should render
    const events = [
      makeEvent({ id: "e1", colorId: "#FF0000" }),
      makeEvent({ id: "e2", colorId: "#00FF00" }),
      makeEvent({ id: "e3", colorId: "#0000FF" }),
      makeEvent({ id: "e4", colorId: "#FFFF00" }),
    ];

    const { toJSON } = await renderWithProviders(
      <MonthView
        events={events}
        selectedDate={TODAY}
        monthStart={MONTH_START}
        onSelectDate={jest.fn()}
      />,
    );

    const tree = toJSON();

    // Count dot elements (width=6, height=6, borderRadius=3)
    let dotCount = 0;
    function countDots(node: ReturnType<typeof toJSON>): void {
      if (!node || typeof node === "string") return;
      if (Array.isArray(node)) {
        node.forEach((n) => countDots(n));
        return;
      }
      const styles = Array.isArray(node.props?.style)
        ? node.props.style
        : [node.props?.style];
      let isDot = false;
      for (const s of styles) {
        if (
          s &&
          typeof s === "object" &&
          s.width === 6 &&
          s.height === 6 &&
          s.borderRadius === 3
        ) {
          isDot = true;
        }
      }
      if (isDot) dotCount++;
      if (node.children) {
        for (const child of node.children) {
          countDots(child as ReturnType<typeof toJSON>);
        }
      }
    }
    countDots(tree);

    // All 4 events are on TODAY but max dots = 3
    expect(dotCount).toBe(3);
  });

  it("displays selected day events using EventCard", async () => {
    const events = [
      makeEvent({
        id: "event-a",
        title: "Morning Meeting",
        startTimestampMs: TODAY + 10 * 60 * 60 * 1000,
        endTimestampMs: TODAY + 11 * 60 * 60 * 1000,
      }),
    ];

    const { getByText } = await renderWithProviders(
      <MonthView
        events={events}
        selectedDate={TODAY}
        monthStart={MONTH_START}
        onSelectDate={jest.fn()}
      />,
    );

    expect(getByText("Morning Meeting")).toBeTruthy();
  });

  it("sorts events: all-day first, then by start time", async () => {
    const laterEvent = makeEvent({
      id: "event-later",
      title: "Afternoon Call",
      startTimestampMs: TODAY + 15 * 60 * 60 * 1000,
      endTimestampMs: TODAY + 16 * 60 * 60 * 1000,
    });
    const earlierEvent = makeEvent({
      id: "event-earlier",
      title: "Morning Standup",
      startTimestampMs: TODAY + 9 * 60 * 60 * 1000,
      endTimestampMs: TODAY + 9.5 * 60 * 60 * 1000,
    });
    const allDayEvent = makeEvent({
      id: "event-allday",
      title: "Holiday",
      allDay: true,
      startTimestampMs: TODAY,
      endTimestampMs: TODAY + MS_PER_DAY,
    });

    // Deliberately pass events in reverse order to test sorting
    const { toJSON } = await renderWithProviders(
      <MonthView
        events={[laterEvent, earlierEvent, allDayEvent]}
        selectedDate={TODAY}
        monthStart={MONTH_START}
        onSelectDate={jest.fn()}
      />,
    );

    // Verify order by checking position of titles in the serialized tree.
    // EventCards are rendered sequentially, so all-day should come first,
    // then events sorted by start time.
    const fullText = JSON.stringify(toJSON());

    const holidayIdx = fullText.indexOf('"Holiday"');
    const morningIdx = fullText.indexOf('"Morning Standup"');
    const afternoonIdx = fullText.indexOf('"Afternoon Call"');

    expect(holidayIdx).toBeGreaterThan(-1);
    expect(morningIdx).toBeGreaterThan(-1);
    expect(afternoonIdx).toBeGreaterThan(-1);

    // All-day event first, then morning (09:00), then afternoon (15:00)
    expect(holidayIdx).toBeLessThan(morningIdx);
    expect(morningIdx).toBeLessThan(afternoonIdx);
  });

  it("shows no-events message when selected day has no events", async () => {
    const { getByText } = await renderWithProviders(
      <MonthView
        events={[]}
        selectedDate={TODAY}
        monthStart={MONTH_START}
        onSelectDate={jest.fn()}
      />,
    );

    expect(getByText("calendar.noEventsForDay")).toBeTruthy();
  });

  it("passes onEventPress to EventCard", async () => {
    const onEventPress = jest.fn();
    const event = makeEvent({
      id: "press-event",
      title: "Pressable Event",
    });

    const { getByText } = await renderWithProviders(
      <MonthView
        events={[event]}
        selectedDate={TODAY}
        monthStart={MONTH_START}
        onSelectDate={jest.fn()}
        onEventPress={onEventPress}
      />,
    );

    await fireEvent.press(getByText("Pressable Event"));
    expect(onEventPress).toHaveBeenCalledWith(event);
  });

  it("passes onCreateAlarm to EventCard for non-all-day events", async () => {
    const onCreateAlarm = jest.fn();
    const event = makeEvent({
      id: "alarm-event",
      title: "Alarm Event",
    });

    const { getByTestId } = await renderWithProviders(
      <MonthView
        events={[event]}
        selectedDate={TODAY}
        monthStart={MONTH_START}
        onSelectDate={jest.fn()}
        onCreateAlarm={onCreateAlarm}
      />,
    );

    await fireEvent.press(getByTestId("event-create-alarm-alarm-event"));
    expect(onCreateAlarm).toHaveBeenCalledWith(event);
  });
});

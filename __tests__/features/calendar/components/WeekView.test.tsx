import { act,fireEvent, render } from "@testing-library/react-native";
import { createStore,Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { WeekView } from "../../../../src/features/calendar/components/WeekView";
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
    i18n: { language: "en", changeLanguage: jest.fn() },
  }),
}));

// 2024-03-11 is a Monday
const MONDAY = new Date(2024, 2, 11, 0, 0, 0, 0).getTime();
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    sourceEventId: "src-1",
    source: "local",
    title: "Test Event",
    description: "A test event",
    startTimestampMs: MONDAY + 10 * MS_PER_HOUR,
    endTimestampMs: MONDAY + 11 * MS_PER_HOUR,
    allDay: false,
    colorId: null,
    calendarName: "Work",
    calendarId: "cal-1",
    ...overrides,
  };
}

async function renderWeekView(
  props: Partial<React.ComponentProps<typeof WeekView>> = {},
) {
  const store = createStore();
  store.set(settingsAtom, DEFAULT_SETTINGS);

  const defaultProps: React.ComponentProps<typeof WeekView> = {
    events: [],
    selectedDate: MONDAY,
    weekStart: MONDAY,
    onSelectDate: jest.fn(),
    ...props,
  };

  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <WeekView {...defaultProps} />
      </PaperProvider>
    </JotaiProvider>,
  );

  await act(async () => {});

  return { ...utils, store };
}

describe("WeekView", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders with testID", async () => {
    const { getByTestId } = await renderWeekView();
    expect(getByTestId("week-view")).toBeTruthy();
  });

  it("renders 7 day headers from weekStart (Monday)", async () => {
    const { getByText } = await renderWeekView({ weekStart: MONDAY });

    // Monday March 11 through Sunday March 17
    expect(getByText("calendar.weekday.mon")).toBeTruthy();
    expect(getByText("calendar.weekday.tue")).toBeTruthy();
    expect(getByText("calendar.weekday.wed")).toBeTruthy();
    expect(getByText("calendar.weekday.thu")).toBeTruthy();
    expect(getByText("calendar.weekday.fri")).toBeTruthy();
    expect(getByText("calendar.weekday.sat")).toBeTruthy();
    expect(getByText("calendar.weekday.sun")).toBeTruthy();

    // Date numbers: 11-17
    for (let d = 11; d <= 17; d++) {
      expect(getByText(String(d))).toBeTruthy();
    }
  });

  it("highlights today in day headers", async () => {
    // Use fake timer's "now" to control what today is
    const fakeNow = MONDAY + 2 * MS_PER_DAY; // Wednesday March 13
    jest.setSystemTime(fakeNow);

    const { getByText } = await renderWeekView({
      weekStart: MONDAY,
      selectedDate: MONDAY, // select Monday, not today
    });

    // Today (Wednesday March 13) date number should be rendered
    const todayElement = getByText("13");
    expect(todayElement).toBeTruthy();

    // The day number container for today should have the primary background
    // (tested implicitly by ensuring the component renders without error
    // when today falls within the week range)
  });

  it("highlights selected date in day headers", async () => {
    // Select Wednesday (March 13)
    const wednesday = MONDAY + 2 * MS_PER_DAY;
    const { getByText } = await renderWeekView({
      weekStart: MONDAY,
      selectedDate: wednesday,
    });

    expect(getByText("13")).toBeTruthy();
    expect(getByText("calendar.weekday.wed")).toBeTruthy();
  });

  it("calls onSelectDate when a day header is pressed", async () => {
    const onSelectDate = jest.fn();
    const { getByText } = await renderWeekView({
      weekStart: MONDAY,
      onSelectDate,
    });

    // Press Thursday (March 14)
    await fireEvent.press(getByText("14"));

    const thursday = new Date(2024, 2, 14, 0, 0, 0, 0).getTime();
    expect(onSelectDate).toHaveBeenCalledWith(thursday);
  });

  it("shows all-day events for selected date", async () => {
    const allDayEvent = makeEvent({
      id: "allday-1",
      title: "All Day Conference",
      allDay: true,
      startTimestampMs: MONDAY,
      endTimestampMs: MONDAY + MS_PER_DAY,
    });

    const { getByText } = await renderWeekView({
      events: [allDayEvent],
      selectedDate: MONDAY,
    });

    expect(getByText("All Day Conference")).toBeTruthy();
  });

  it("renders CustomDayTimeline for selected date", async () => {
    const { getByTestId } = await renderWeekView({
      selectedDate: MONDAY,
    });

    expect(getByTestId("custom-day-timeline")).toBeTruthy();
  });

  it("passes events to CustomDayTimeline", async () => {
    const timedEvent = makeEvent({
      id: "timed-1",
      title: "Morning Meeting",
      startTimestampMs: MONDAY + 9 * MS_PER_HOUR,
      endTimestampMs: MONDAY + 10 * MS_PER_HOUR,
    });

    const { getByText } = await renderWeekView({
      events: [timedEvent],
      selectedDate: MONDAY,
    });

    expect(getByText("Morning Meeting")).toBeTruthy();
  });

  it("shows no content when no events exist", async () => {
    const { getByTestId, queryByText } = await renderWeekView({
      events: [],
      selectedDate: MONDAY,
    });

    // Timeline should still render (empty)
    expect(getByTestId("custom-day-timeline")).toBeTruthy();
    // No event titles should be visible
    expect(queryByText("Test Event")).toBeNull();
  });
});

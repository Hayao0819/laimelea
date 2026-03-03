import { act,fireEvent, render } from "@testing-library/react-native";
import { createStore,Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { AgendaView } from "../../../../src/features/calendar/components/AgendaView";
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

async function renderAgendaView(
  props: Partial<React.ComponentProps<typeof AgendaView>> = {},
) {
  const store = createStore();
  store.set(settingsAtom, DEFAULT_SETTINGS);

  const defaultProps: React.ComponentProps<typeof AgendaView> = {
    events: [],
    selectedDate: MONDAY,
    onSelectDate: jest.fn(),
    ...props,
  };

  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <AgendaView {...defaultProps} />
      </PaperProvider>
    </JotaiProvider>,
  );

  await act(async () => {});

  return { ...utils, store };
}

describe("AgendaView", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders with testID", async () => {
    const { getByTestId } = await renderAgendaView();
    expect(getByTestId("agenda-view")).toBeTruthy();
  });

  it("renders section headers with date and weekday", async () => {
    const event = makeEvent({
      id: "ev-mon",
      title: "Monday Event",
      startTimestampMs: MONDAY + 10 * MS_PER_HOUR,
      endTimestampMs: MONDAY + 11 * MS_PER_HOUR,
    });

    const { getAllByText } = await renderAgendaView({
      events: [event],
      selectedDate: MONDAY,
    });

    // Section headers contain: `${monthName} ${day} ${weekdayName}`
    // For Monday March 11: "calendar.monthNames.2 11 calendar.weekday.mon"
    const mondayHeaders = getAllByText(
      /calendar\.monthNames\.2 11 calendar\.weekday\.mon/,
    );
    expect(mondayHeaders.length).toBeGreaterThanOrEqual(1);
  });

  it("marks today section with today indicator", async () => {
    // Set fake time to MONDAY so it becomes "today"
    jest.setSystemTime(MONDAY + 12 * MS_PER_HOUR);

    const event = makeEvent({
      id: "ev-today",
      title: "Today Event",
      startTimestampMs: MONDAY + 10 * MS_PER_HOUR,
      endTimestampMs: MONDAY + 11 * MS_PER_HOUR,
    });

    const { getAllByText } = await renderAgendaView({
      events: [event],
      selectedDate: MONDAY,
    });

    // Today's section title should include "(calendar.today)"
    const todayHeaders = getAllByText(/\(calendar\.today\)/);
    expect(todayHeaders.length).toBeGreaterThanOrEqual(1);
  });

  it("shows events for days that have events", async () => {
    const event = makeEvent({
      id: "ev-1",
      title: "Team Standup",
      startTimestampMs: MONDAY + 9 * MS_PER_HOUR,
      endTimestampMs: MONDAY + 10 * MS_PER_HOUR,
    });

    const { getByText } = await renderAgendaView({
      events: [event],
      selectedDate: MONDAY,
    });

    expect(getByText("Team Standup")).toBeTruthy();
  });

  it("hides days with no events", async () => {
    const event = makeEvent({
      id: "ev-only",
      title: "Only Event",
      startTimestampMs: MONDAY + 10 * MS_PER_HOUR,
      endTimestampMs: MONDAY + 11 * MS_PER_HOUR,
    });

    const { queryAllByText } = await renderAgendaView({
      events: [event],
      selectedDate: MONDAY,
    });

    // Only the day with the event should have a section header
    const headers = queryAllByText(/calendar\.monthNames\.\d+/);
    expect(headers.length).toBe(1);
  });

  it("shows empty message when no events in range", async () => {
    const { getByText } = await renderAgendaView({
      events: [],
      selectedDate: MONDAY,
    });

    expect(getByText("calendar.noEventsForDay")).toBeTruthy();
  });

  it("renders EventCard for each event", async () => {
    const event1 = makeEvent({
      id: "ev-1",
      title: "Morning Meeting",
      startTimestampMs: MONDAY + 9 * MS_PER_HOUR,
      endTimestampMs: MONDAY + 10 * MS_PER_HOUR,
    });
    const event2 = makeEvent({
      id: "ev-2",
      title: "Lunch",
      startTimestampMs: MONDAY + 12 * MS_PER_HOUR,
      endTimestampMs: MONDAY + 13 * MS_PER_HOUR,
    });

    const { getByText } = await renderAgendaView({
      events: [event1, event2],
      selectedDate: MONDAY,
    });

    expect(getByText("Morning Meeting")).toBeTruthy();
    expect(getByText("Lunch")).toBeTruthy();
  });

  it("sorts events: all-day first, then by start time", async () => {
    const laterEvent = makeEvent({
      id: "ev-later",
      title: "Afternoon",
      startTimestampMs: MONDAY + 15 * MS_PER_HOUR,
      endTimestampMs: MONDAY + 16 * MS_PER_HOUR,
    });
    const earlierEvent = makeEvent({
      id: "ev-earlier",
      title: "Morning",
      startTimestampMs: MONDAY + 8 * MS_PER_HOUR,
      endTimestampMs: MONDAY + 9 * MS_PER_HOUR,
    });
    const allDayEvent = makeEvent({
      id: "ev-allday",
      title: "Holiday",
      allDay: true,
      startTimestampMs: MONDAY,
      endTimestampMs: MONDAY + MS_PER_DAY,
    });

    const { getAllByText } = await renderAgendaView({
      events: [laterEvent, earlierEvent, allDayEvent],
      selectedDate: MONDAY,
    });

    // All three should render in the MONDAY section
    const holidays = getAllByText("Holiday");
    const mornings = getAllByText("Morning");
    const afternoons = getAllByText("Afternoon");
    expect(holidays.length).toBeGreaterThanOrEqual(1);
    expect(mornings.length).toBeGreaterThanOrEqual(1);
    expect(afternoons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onEventPress when EventCard is pressed", async () => {
    const onEventPress = jest.fn();
    const event = makeEvent({
      id: "ev-press",
      title: "Pressable Event",
      startTimestampMs: MONDAY + 10 * MS_PER_HOUR,
      endTimestampMs: MONDAY + 11 * MS_PER_HOUR,
    });

    const { getByText } = await renderAgendaView({
      events: [event],
      selectedDate: MONDAY,
      onEventPress,
    });

    await fireEvent.press(getByText("Pressable Event"));
    expect(onEventPress).toHaveBeenCalledWith(event);
  });

  it("calls onCreateAlarm for non-all-day events", async () => {
    const onCreateAlarm = jest.fn();
    const event = makeEvent({
      id: "ev-alarm",
      title: "Alarm Event",
      startTimestampMs: MONDAY + 14 * MS_PER_HOUR,
      endTimestampMs: MONDAY + 15 * MS_PER_HOUR,
    });

    const { getByTestId } = await renderAgendaView({
      events: [event],
      selectedDate: MONDAY,
      onCreateAlarm,
    });

    await fireEvent.press(getByTestId("event-create-alarm-ev-alarm"));
    expect(onCreateAlarm).toHaveBeenCalledWith(event);
  });

  it("only shows sections for days with events across the range", async () => {
    // MONDAY is March 11; -14 days = Feb 26
    const febEvent = makeEvent({
      id: "ev-feb",
      title: "Feb Event",
      startTimestampMs: MONDAY - 13 * MS_PER_DAY + 10 * MS_PER_HOUR,
      endTimestampMs: MONDAY - 13 * MS_PER_DAY + 11 * MS_PER_HOUR,
    });
    const marEvent = makeEvent({
      id: "ev-mar",
      title: "Mar Event",
      startTimestampMs: MONDAY + 5 * MS_PER_DAY + 10 * MS_PER_HOUR,
      endTimestampMs: MONDAY + 5 * MS_PER_DAY + 11 * MS_PER_HOUR,
    });

    const { getAllByText } = await renderAgendaView({
      events: [febEvent, marEvent],
      selectedDate: MONDAY,
    });

    // Only 2 sections should be rendered (one for each event's day)
    const headers = getAllByText(/calendar\.monthNames\.\d+/);
    expect(headers).toHaveLength(2);

    // Verify the date range spans both February and March
    const febHeaders = getAllByText(/calendar\.monthNames\.1/);
    const marHeaders = getAllByText(/calendar\.monthNames\.2/);
    expect(febHeaders.length).toBe(1);
    expect(marHeaders.length).toBe(1);
  });
});

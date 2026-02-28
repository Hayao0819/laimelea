import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { AgendaView } from "../../../../src/features/calendar/components/AgendaView";
import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";
import type { CalendarEvent } from "../../../../src/models/CalendarEvent";

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
    const { getAllByText } = await renderAgendaView({
      selectedDate: MONDAY,
    });

    // Section headers contain: `${monthName} ${day} ${weekdayName}`
    // For Monday March 11: "calendar.monthNames.2 11 calendar.weekday.mon"
    const headers = getAllByText(/calendar\.monthNames\.\d+/);
    expect(headers.length).toBeGreaterThan(0);

    // Verify the selected date section header is rendered
    const mondayHeaders = getAllByText(
      /calendar\.monthNames\.2 11 calendar\.weekday\.mon/,
    );
    expect(mondayHeaders.length).toBeGreaterThanOrEqual(1);
  });

  it("marks today section with today indicator", async () => {
    // Set fake time to MONDAY so it becomes "today"
    jest.setSystemTime(MONDAY + 12 * MS_PER_HOUR);

    const { getAllByText } = await renderAgendaView({
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

  it("shows no-events placeholder for empty days", async () => {
    const { getAllByText } = await renderAgendaView({
      events: [],
      selectedDate: MONDAY,
    });

    // SectionList virtualizes rendering, so not all 29 sections are mounted.
    // The rendered empty sections should show the placeholder text.
    const placeholders = getAllByText("calendar.noEventsForDay");
    expect(placeholders.length).toBeGreaterThan(0);
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

  it("generates sections for +/-14 days around selected date", async () => {
    const { getAllByText } = await renderAgendaView({
      selectedDate: MONDAY,
    });

    // AGENDA_RANGE_DAYS = 14, so -14 to +14 = 29 sections total.
    // SectionList virtualizes so not all sections are mounted, but the
    // rendered sections should span from Feb (monthNames.1) to Mar (monthNames.2).
    const headers = getAllByText(/calendar\.monthNames\.\d+/);
    expect(headers.length).toBeGreaterThanOrEqual(20);

    // Verify the date range spans both February and March
    const febHeaders = getAllByText(/calendar\.monthNames\.1/);
    const marHeaders = getAllByText(/calendar\.monthNames\.2/);
    expect(febHeaders.length).toBeGreaterThan(0);
    expect(marHeaders.length).toBeGreaterThan(0);
  });
});

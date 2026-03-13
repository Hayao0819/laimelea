import { act, fireEvent, render } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import {
  EventCard,
  formatDuration,
} from "../../../src/features/calendar/components/EventCard";
import type { CalendarEvent } from "../../../src/models/CalendarEvent";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";

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

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    sourceEventId: "src-1",
    source: "local",
    title: "Team Meeting",
    description: "Weekly standup",
    startTimestampMs: new Date("2026-03-01T10:30:00Z").getTime(),
    endTimestampMs: new Date("2026-03-01T11:30:00Z").getTime(),
    allDay: false,
    colorId: null,
    calendarName: "Work",
    calendarId: "cal-1",
    ...overrides,
  };
}

async function renderWithProviders(
  ui: React.ReactElement,
  store = createStore(),
) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  const utils = await render(
    <JotaiProvider store={store}>
      <PaperProvider>{ui}</PaperProvider>
    </JotaiProvider>,
  );
  await act(async () => {});
  return { ...utils, store };
}

const originalConsoleError = console.error;

beforeEach(() => {
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (msg.includes("suspended inside an `act` scope")) return;
    if (msg.includes("suspended resource finished loading")) return;
    originalConsoleError(...args);
  };
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe("EventCard", () => {
  it("should display time range and custom time for normal events", async () => {
    const event = makeEvent();
    const { getByText } = await renderWithProviders(
      <EventCard event={event} />,
    );

    expect(getByText(/calendar\.timeRange/)).toBeTruthy();
    expect(getByText(/calendar\.customTime/)).toBeTruthy();
  });

  it("should display All Day label and hide time for all-day events", async () => {
    const event = makeEvent({ allDay: true });
    const { getByText, queryByText } = await renderWithProviders(
      <EventCard event={event} />,
    );

    expect(getByText("calendar.allDay")).toBeTruthy();
    expect(queryByText(/calendar\.timeRange/)).toBeNull();
    expect(queryByText(/calendar\.customTime/)).toBeNull();
  });

  it("should show alarm-plus button when onCreateAlarm is provided", async () => {
    const event = makeEvent();
    const onCreateAlarm = jest.fn();
    const { getByTestId } = await renderWithProviders(
      <EventCard event={event} onCreateAlarm={onCreateAlarm} />,
    );

    expect(getByTestId(`event-create-alarm-${event.id}`)).toBeTruthy();
  });

  it("should hide alarm-plus button when onCreateAlarm is undefined", async () => {
    const event = makeEvent();
    const { queryByTestId } = await renderWithProviders(
      <EventCard event={event} />,
    );

    expect(queryByTestId(`event-create-alarm-${event.id}`)).toBeNull();
  });

  it("should hide alarm-plus button for all-day events", async () => {
    const event = makeEvent({ allDay: true });
    const onCreateAlarm = jest.fn();
    const { queryByTestId } = await renderWithProviders(
      <EventCard event={event} onCreateAlarm={onCreateAlarm} />,
    );

    expect(queryByTestId(`event-create-alarm-${event.id}`)).toBeNull();
  });

  it("should call onCreateAlarm with event when alarm-plus button is pressed", async () => {
    const event = makeEvent();
    const onCreateAlarm = jest.fn();
    const { getByTestId } = await renderWithProviders(
      <EventCard event={event} onCreateAlarm={onCreateAlarm} />,
    );

    await fireEvent.press(getByTestId(`event-create-alarm-${event.id}`));
    expect(onCreateAlarm).toHaveBeenCalledWith(event);
  });

  it("should apply left border with event color", async () => {
    const event = makeEvent({ colorId: "#FF5733" });
    const { toJSON } = await renderWithProviders(
      <EventCard event={event} onCreateAlarm={jest.fn()} />,
    );

    const tree = toJSON();

    function findByBorderColor(
      node: ReturnType<typeof toJSON>,
      color: string,
    ): boolean {
      if (!node || typeof node === "string") return false;
      if (Array.isArray(node))
        return node.some((n) => findByBorderColor(n, color));
      const styles = Array.isArray(node.props?.style)
        ? node.props.style
        : [node.props?.style];
      for (const s of styles) {
        if (
          s &&
          typeof s === "object" &&
          s.borderLeftColor === color &&
          s.borderLeftWidth === 4
        ) {
          return true;
        }
      }
      if (node.children) {
        for (const child of node.children) {
          if (findByBorderColor(child as ReturnType<typeof toJSON>, color)) {
            return true;
          }
        }
      }
      return false;
    }

    expect(findByBorderColor(tree, "#FF5733")).toBe(true);
  });

  it("should use theme primary color when colorId is null", async () => {
    const event = makeEvent({ colorId: null });
    const { toJSON } = await renderWithProviders(<EventCard event={event} />);

    const tree = toJSON();

    function findLeftBorder(node: ReturnType<typeof toJSON>): boolean {
      if (!node || typeof node === "string") return false;
      if (Array.isArray(node)) return node.some((n) => findLeftBorder(n));
      const styles = Array.isArray(node.props?.style)
        ? node.props.style
        : [node.props?.style];
      for (const s of styles) {
        if (s && typeof s === "object" && s.borderLeftWidth === 4) {
          return true;
        }
      }
      if (node.children) {
        for (const child of node.children) {
          if (findLeftBorder(child as ReturnType<typeof toJSON>)) {
            return true;
          }
        }
      }
      return false;
    }

    expect(findLeftBorder(tree)).toBe(true);
  });

  it("should display time range with start and end times", async () => {
    const event = makeEvent({
      startTimestampMs: new Date("2026-03-01T10:30:00Z").getTime(),
      endTimestampMs: new Date("2026-03-01T11:30:00Z").getTime(),
    });
    const { getByText } = await renderWithProviders(
      <EventCard event={event} />,
    );

    const timeRangeText = getByText(/calendar\.timeRange/);
    expect(timeRangeText).toBeTruthy();
    // The mock renders as key:JSON, verify both start and end keys exist
    const content = timeRangeText.props.children;
    expect(content).toMatch(/calendar\.timeRange/);
    expect(content).toMatch(/"start":"\d{2}:\d{2}"/);
    expect(content).toMatch(/"end":"\d{2}:\d{2}"/);
  });

  it("should display duration badge for timed events", async () => {
    const event = makeEvent({
      startTimestampMs: new Date("2026-03-01T10:30:00Z").getTime(),
      endTimestampMs: new Date("2026-03-01T11:30:00Z").getTime(),
    });
    const { getByText } = await renderWithProviders(
      <EventCard event={event} />,
    );

    expect(getByText(/calendar\.duration\.hours/)).toBeTruthy();
  });

  it("should hide duration for zero-duration events", async () => {
    const ts = new Date("2026-03-01T10:30:00Z").getTime();
    const event = makeEvent({
      startTimestampMs: ts,
      endTimestampMs: ts,
    });
    const { queryByText } = await renderWithProviders(
      <EventCard event={event} />,
    );

    expect(queryByText(/calendar\.duration/)).toBeNull();
  });

  it("should apply background color for all-day events", async () => {
    const event = makeEvent({ allDay: true, colorId: "#4285F4" });
    const { toJSON } = await renderWithProviders(<EventCard event={event} />);

    const tree = toJSON();

    function findByBgColor(
      node: ReturnType<typeof toJSON>,
      colorPrefix: string,
    ): boolean {
      if (!node || typeof node === "string") return false;
      if (Array.isArray(node))
        return node.some((n) => findByBgColor(n, colorPrefix));
      const styles = Array.isArray(node.props?.style)
        ? node.props.style
        : [node.props?.style];
      for (const s of styles) {
        if (
          s &&
          typeof s === "object" &&
          typeof s.backgroundColor === "string" &&
          s.backgroundColor.startsWith(colorPrefix)
        ) {
          return true;
        }
      }
      if (node.children) {
        for (const child of node.children) {
          if (findByBgColor(child as ReturnType<typeof toJSON>, colorPrefix)) {
            return true;
          }
        }
      }
      return false;
    }

    expect(findByBgColor(tree, "#4285F4")).toBe(true);
  });

  it("should not apply background color for timed events", async () => {
    const event = makeEvent({ allDay: false, colorId: "#4285F4" });
    const { toJSON } = await renderWithProviders(<EventCard event={event} />);

    const tree = toJSON();

    function findAllDayBg(node: ReturnType<typeof toJSON>): boolean {
      if (!node || typeof node === "string") return false;
      if (Array.isArray(node)) return node.some((n) => findAllDayBg(n));
      const styles = Array.isArray(node.props?.style)
        ? node.props.style
        : [node.props?.style];
      for (const s of styles) {
        if (
          s &&
          typeof s === "object" &&
          typeof s.backgroundColor === "string" &&
          s.backgroundColor === "#4285F426"
        ) {
          return true;
        }
      }
      if (node.children) {
        for (const child of node.children) {
          if (findAllDayBg(child as ReturnType<typeof toJSON>)) {
            return true;
          }
        }
      }
      return false;
    }

    expect(findAllDayBg(tree)).toBe(false);
  });

  it("should call onPress with event when card is pressed", async () => {
    const event = makeEvent();
    const onPress = jest.fn();
    const { getByText } = await renderWithProviders(
      <EventCard event={event} onPress={onPress} />,
    );

    await fireEvent.press(getByText("Team Meeting"));
    expect(onPress).toHaveBeenCalledWith(event);
  });
});

describe("formatDuration", () => {
  it("returns empty string when start equals end", () => {
    const ts = Date.now();
    expect(formatDuration(ts, ts)).toBe("");
  });

  it("returns empty string when end is before start", () => {
    expect(formatDuration(1000, 500)).toBe("");
  });

  it("formats minutes only", () => {
    const start = 0;
    const end = 30 * 60 * 1000; // 30 min
    expect(formatDuration(start, end)).toBe("30m");
  });

  it("formats hours only", () => {
    const start = 0;
    const end = 2 * 60 * 60 * 1000; // 2h
    expect(formatDuration(start, end)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    const start = 0;
    const end = 90 * 60 * 1000; // 1h 30m
    expect(formatDuration(start, end)).toBe("1h 30m");
  });

  it("formats days for long durations", () => {
    const start = 0;
    const end = 2 * 24 * 60 * 60 * 1000; // 2 days
    expect(formatDuration(start, end)).toBe("2d");
  });

  it("formats 1 day for exactly 24h", () => {
    const start = 0;
    const end = 24 * 60 * 60 * 1000;
    expect(formatDuration(start, end)).toBe("1d");
  });

  it("formats sub-24h all-day event as 1d", () => {
    const start = 0;
    const end = 24 * 60 * 60 * 1000;
    expect(formatDuration(start, end)).toBe("1d");
  });
});

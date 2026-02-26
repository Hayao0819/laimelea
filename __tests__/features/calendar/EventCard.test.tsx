import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { EventCard } from "../../../src/features/calendar/components/EventCard";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";
import type { CalendarEvent } from "../../../src/models/CalendarEvent";

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
    t: (key: string, opts?: Record<string, string>) => {
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

function renderWithProviders(
  ui: React.ReactElement,
  store = createStore(),
) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>{ui}</PaperProvider>
    </JotaiProvider>,
  );
  return { ...utils, store };
}

describe("EventCard", () => {
  it("should display realTime and customTime for normal events", async () => {
    const event = makeEvent();
    const { getByText } = await renderWithProviders(
      <EventCard event={event} />,
    );

    // The component uses t() with params, which our mock renders as key:JSON
    expect(getByText(/calendar\.realTime/)).toBeTruthy();
    expect(getByText(/calendar\.customTime/)).toBeTruthy();
  });

  it("should display All Day chip and hide time for all-day events", async () => {
    const event = makeEvent({ allDay: true });
    const { getByText, queryByText } = await renderWithProviders(
      <EventCard event={event} />,
    );

    expect(getByText("calendar.allDay")).toBeTruthy();
    expect(queryByText(/calendar\.realTime/)).toBeNull();
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

  it("should use event colorId for the color dot when set", async () => {
    const event = makeEvent({ colorId: "#FF5733" });
    const { toJSON } = await renderWithProviders(
      <EventCard event={event} onCreateAlarm={jest.fn()} />,
    );

    const tree = toJSON();

    // Recursively find a node whose style includes backgroundColor === "#FF5733"
    function findByBgColor(
      node: ReturnType<typeof toJSON>,
      color: string,
    ): boolean {
      if (!node || typeof node === "string") return false;
      if (Array.isArray(node)) return node.some((n) => findByBgColor(n, color));
      const styles = Array.isArray(node.props?.style)
        ? node.props.style
        : [node.props?.style];
      for (const s of styles) {
        if (s && typeof s === "object" && s.backgroundColor === color) {
          return true;
        }
      }
      if (node.children) {
        for (const child of node.children) {
          if (findByBgColor(child as ReturnType<typeof toJSON>, color)) {
            return true;
          }
        }
      }
      return false;
    }

    expect(findByBgColor(tree, "#FF5733")).toBe(true);
  });
});

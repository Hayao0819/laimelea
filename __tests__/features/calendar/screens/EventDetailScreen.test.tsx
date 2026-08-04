import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { alarmsAtom } from "../../../../src/atoms/alarmAtoms";
import { calendarEventsAtom } from "../../../../src/atoms/calendarAtoms";
import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { scheduleAlarm } from "../../../../src/features/alarm/services/alarmScheduler";
import { EventDetailScreen } from "../../../../src/features/calendar/screens/EventDetailScreen";
import type { Alarm } from "../../../../src/models/Alarm";
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

jest.mock("../../../../src/core/storage/asyncStorageAdapter", () => ({
  createAsyncStorage: () => {
    const storage = new Map<string, unknown>();
    return {
      getItem: (key: string, initialValue: unknown) =>
        storage.has(key) ? storage.get(key) : initialValue,
      setItem: (key: string, value: unknown) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: "en" },
  }),
}));

const mockGoBack = jest.fn();
let mockRouteParams = { eventId: "event-1" };

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue("alarm"),
    createTriggerNotification: jest.fn().mockResolvedValue("trigger-id"),
    cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    onForegroundEvent: jest.fn().mockReturnValue(() => {}),
    onBackgroundEvent: jest.fn(),
  },
  TriggerType: { TIMESTAMP: 0 },
  AndroidImportance: { HIGH: 4 },
  AndroidCategory: { ALARM: "alarm" },
  AuthorizationStatus: { AUTHORIZED: 1 },
}));

jest.mock("../../../../src/features/alarm/services/alarmScheduler", () => ({
  cancelAlarm: jest.fn().mockResolvedValue(undefined),
  recoverAlarmSchedule: jest.fn(async (alarm: Alarm) => ({
    ...alarm,
    notifeeTriggerId: "trigger-id",
  })),
  scheduleAlarm: jest.fn().mockResolvedValue("trigger-id"),
}));

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    sourceEventId: "src-1",
    source: "google",
    title: "Team Meeting",
    description: "Weekly sync meeting",
    startTimestampMs: new Date("2026-03-01T10:00:00").getTime(),
    endTimestampMs: new Date("2026-03-01T11:00:00").getTime(),
    allDay: false,
    colorId: null,
    calendarName: "Work Calendar",
    calendarId: "cal-1",
    ...overrides,
  };
}

async function renderWithProviders(options?: {
  events?: CalendarEvent[];
  routeEventId?: string;
}) {
  const { events = [makeEvent()], routeEventId = "event-1" } = options ?? {};

  mockRouteParams = { eventId: routeEventId };

  const store = createStore();
  store.set(settingsAtom, DEFAULT_SETTINGS);
  store.set(alarmsAtom, []);
  store.set(calendarEventsAtom, events);

  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <EventDetailScreen />
      </PaperProvider>
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

describe("EventDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders event title", async () => {
    const { getByText } = await renderWithProviders();
    expect(getByText("Team Meeting")).toBeTruthy();
  });

  it("shows event not found when event doesn't exist", async () => {
    const { getByText } = await renderWithProviders({
      events: [],
      routeEventId: "nonexistent",
    });
    expect(getByText("calendar.eventNotFound")).toBeTruthy();
  });

  it("displays start and end times for timed events", async () => {
    const { getByText } = await renderWithProviders();

    // The component uses formatDateTime(ms) -> format(new Date(ms), "yyyy/MM/dd HH:mm")
    const startDate = new Date("2026-03-01T10:00:00");
    const endDate = new Date("2026-03-01T11:00:00");
    const expectedStart = `${startDate.getFullYear()}/${String(startDate.getMonth() + 1).padStart(2, "0")}/${String(startDate.getDate()).padStart(2, "0")} ${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`;
    const expectedEnd = `${endDate.getFullYear()}/${String(endDate.getMonth() + 1).padStart(2, "0")}/${String(endDate.getDate()).padStart(2, "0")} ${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;

    expect(getByText(expectedStart)).toBeTruthy();
    expect(getByText(expectedEnd)).toBeTruthy();
  });

  it("displays all-day chip for all-day events", async () => {
    const event = makeEvent({ allDay: true });
    const { getByTestId } = await renderWithProviders({ events: [event] });
    expect(getByTestId("all-day-chip")).toBeTruthy();
  });

  it("shows custom time display", async () => {
    const { getAllByText } = await renderWithProviders();
    // The i18n mock renders "calendar.customTime:{"time":"HH:MM"}"
    const customTimeTexts = getAllByText(/calendar\.customTime/);
    expect(customTimeTexts.length).toBe(2); // one for start, one for end
  });

  it("shows description card when description exists", async () => {
    const event = makeEvent({ description: "Important meeting notes" });
    const { getByTestId, getByText } = await renderWithProviders({
      events: [event],
    });
    expect(getByTestId("description-card")).toBeTruthy();
    expect(getByText("Important meeting notes")).toBeTruthy();
  });

  it("hides description card when description is empty", async () => {
    const event = makeEvent({ description: "" });
    const { queryByTestId } = await renderWithProviders({ events: [event] });
    expect(queryByTestId("description-card")).toBeNull();
  });

  it("shows calendar name and source", async () => {
    const event = makeEvent({
      calendarName: "Personal Calendar",
      source: "google",
    });
    const { getAllByText, getByText } = await renderWithProviders({
      events: [event],
    });
    // calendarName appears in header and in the detail card
    expect(getAllByText("Personal Calendar").length).toBeGreaterThanOrEqual(1);
    expect(getByText("google")).toBeTruthy();
  });

  it("shows create alarm button for non-all-day events", async () => {
    const event = makeEvent({ allDay: false });
    const { getByTestId } = await renderWithProviders({ events: [event] });
    expect(getByTestId("create-alarm-button")).toBeTruthy();
  });

  it("hides create alarm button for all-day events", async () => {
    const event = makeEvent({ allDay: true });
    const { queryByTestId } = await renderWithProviders({ events: [event] });
    expect(queryByTestId("create-alarm-button")).toBeNull();
  });

  it("creates alarm when button is pressed", async () => {
    const futureStart = Date.now() + 60 * 60 * 1000;
    const event = makeEvent({
      id: "event-alarm",
      title: "Important Meeting",
      startTimestampMs: futureStart,
      endTimestampMs: futureStart + 60 * 60 * 1000,
    });

    const { getByTestId, store } = await renderWithProviders({
      events: [event],
      routeEventId: "event-alarm",
    });

    await act(async () => {
      fireEvent.press(getByTestId("create-alarm-button"));
    });

    expect(scheduleAlarm).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Important Meeting",
        linkedCalendarEventId: "event-alarm",
        enabled: true,
      }),
    );

    // Verify alarm was added to store
    const alarms = await store.get(alarmsAtom);
    expect(alarms.length).toBe(1);
    expect(alarms[0].label).toBe("Important Meeting");
    expect(alarms[0].linkedCalendarEventId).toBe("event-alarm");
    expect(alarms[0].notifeeTriggerId).toBe("trigger-id");

    // Verify navigation.goBack was called
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("does not persist or navigate when scheduling fails", async () => {
    const futureStart = Date.now() + 60 * 60 * 1000;
    const event = makeEvent({
      id: "failed-event",
      startTimestampMs: futureStart,
      endTimestampMs: futureStart + 60 * 60 * 1000,
    });
    (scheduleAlarm as jest.Mock).mockRejectedValueOnce(new Error("failed"));

    const { getByTestId, getByText, store } = await renderWithProviders({
      events: [event],
      routeEventId: "failed-event",
    });

    await act(async () => {
      fireEvent.press(getByTestId("create-alarm-button"));
    });

    expect(store.get(alarmsAtom)).toEqual([]);
    expect(mockGoBack).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(getByText("calendar.alarmScheduleFailed")).toBeTruthy();
    });
  });

  it("does not schedule a past event", async () => {
    const pastStart = Date.now() - 60 * 60 * 1000;
    const event = makeEvent({
      id: "past-event",
      startTimestampMs: pastStart,
      endTimestampMs: pastStart + 30 * 60 * 1000,
    });

    const { getByTestId, getByText, store } = await renderWithProviders({
      events: [event],
      routeEventId: "past-event",
    });

    await act(async () => {
      fireEvent.press(getByTestId("create-alarm-button"));
    });

    expect(scheduleAlarm).not.toHaveBeenCalled();
    expect(store.get(alarmsAtom)).toEqual([]);
    await waitFor(() => {
      expect(getByText("calendar.alarmTimePassed")).toBeTruthy();
    });
  });
});

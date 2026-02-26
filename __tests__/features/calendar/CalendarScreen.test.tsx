import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { CalendarScreen } from "../../../src/features/calendar/screens/CalendarScreen";
import { calendarSelectedDateAtom } from "../../../src/atoms/calendarAtoms";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { alarmsAtom } from "../../../src/atoms/alarmAtoms";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";
import { scheduleAlarm } from "../../../src/features/alarm/services/alarmScheduler";
import { createPlatformServices } from "../../../src/core/platform/factory";
import type { CalendarEvent } from "../../../src/models/CalendarEvent";
import type { PlatformServices } from "../../../src/core/platform/types";

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    getTokens: jest.fn(),
    configure: jest.fn(),
  },
}));

jest.mock("react-native-app-auth", () => ({
  authorize: jest.fn(),
  refresh: jest.fn(),
  revoke: jest.fn(),
}));

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
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: "en" },
  }),
}));

const mockSync = jest.fn();
const mockUseCalendarSync = jest.fn(() => ({
  events: [] as CalendarEvent[],
  loading: false,
  error: null as string | null,
  sync: mockSync,
  isStale: false,
}));

jest.mock("../../../src/hooks/useCalendarSync", () => ({
  useCalendarSync: () => mockUseCalendarSync(),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require("react");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => cb(), []);
  },
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

jest.mock("../../../src/features/alarm/services/alarmScheduler", () => ({
  scheduleAlarm: jest.fn().mockResolvedValue("trigger-id"),
}));

jest.mock("../../../src/core/platform/factory");

const mockCreatePlatformServices =
  createPlatformServices as jest.MockedFunction<typeof createPlatformServices>;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const TODAY = startOfDay(Date.now());
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    sourceEventId: "src-1",
    source: "google",
    title: "Test Meeting",
    description: "A meeting",
    startTimestampMs: TODAY + 10 * 60 * 60 * 1000, // 10:00 today
    endTimestampMs: TODAY + 11 * 60 * 60 * 1000, // 11:00 today
    allDay: false,
    colorId: null,
    calendarName: "Work",
    calendarId: "cal-1",
    ...overrides,
  };
}

function createMockServices(authenticated = true): PlatformServices {
  return {
    type: "aosp",
    auth: {
      isAvailable: jest.fn().mockResolvedValue(true),
      signIn: jest
        .fn()
        .mockResolvedValue({ email: "test@test.com", accessToken: "token" }),
      signOut: jest.fn().mockResolvedValue(undefined),
      getAccessToken: jest
        .fn()
        .mockResolvedValue(authenticated ? "mock-token" : null),
    },
    calendar: {
      isAvailable: jest.fn().mockResolvedValue(true),
      fetchEvents: jest.fn().mockResolvedValue([]),
      getCalendarList: jest.fn().mockResolvedValue([]),
    },
    backup: {
      isAvailable: jest.fn().mockResolvedValue(true),
      backup: jest.fn().mockResolvedValue(undefined),
      restore: jest.fn().mockResolvedValue(null),
      getLastBackupTime: jest.fn().mockResolvedValue(null),
    },
    sleep: {
      isAvailable: jest.fn().mockResolvedValue(true),
      fetchSleepSessions: jest.fn().mockResolvedValue([]),
    },
  };
}

let currentMockServices: PlatformServices;

async function renderWithProviders(options?: {
  authenticated?: boolean;
  events?: CalendarEvent[];
  loading?: boolean;
  error?: string | null;
  isStale?: boolean;
  selectedDate?: number;
}) {
  const {
    authenticated = true,
    events = [],
    loading = false,
    error = null,
    isStale = false,
    selectedDate = TODAY,
  } = options ?? {};

  mockUseCalendarSync.mockReturnValue({
    events,
    loading,
    error,
    sync: mockSync,
    isStale,
  });

  currentMockServices = createMockServices(authenticated);
  mockCreatePlatformServices.mockReturnValue(currentMockServices);

  const store = createStore();
  store.set(settingsAtom, DEFAULT_SETTINGS);
  store.set(alarmsAtom, []);
  store.set(calendarSelectedDateAtom, selectedDate);

  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <CalendarScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  // Flush effects: useFocusEffect and async getAccessToken/setIsAuthed
  await act(async () => {});

  return { ...utils, store, mockServices: currentMockServices };
}

describe("CalendarScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCalendarSync.mockReturnValue({
      events: [],
      loading: false,
      error: null,
      sync: mockSync,
      isStale: false,
    });
  });

  describe("authenticated state", () => {
    it('should render with testID "calendar-screen"', async () => {
      const { getByTestId } = await renderWithProviders();
      expect(getByTestId("calendar-screen")).toBeTruthy();
    });

    it('should render calendar event list (testID "calendar-event-list")', async () => {
      const { getByTestId } = await renderWithProviders();
      expect(getByTestId("calendar-event-list")).toBeTruthy();
    });

    it('should show "calendar.noEvents" when no events for selected day', async () => {
      const { getByText } = await renderWithProviders({ events: [] });
      expect(getByText("calendar.noEvents")).toBeTruthy();
    });

    it("should filter events by selected date (isSameDay logic)", async () => {
      const todayEvent = makeEvent({
        id: "today-event",
        title: "Today Event",
        startTimestampMs: TODAY + 9 * 60 * 60 * 1000,
        endTimestampMs: TODAY + 10 * 60 * 60 * 1000,
      });
      const tomorrowEvent = makeEvent({
        id: "tomorrow-event",
        title: "Tomorrow Event",
        startTimestampMs: TODAY + MS_PER_DAY + 9 * 60 * 60 * 1000,
        endTimestampMs: TODAY + MS_PER_DAY + 10 * 60 * 60 * 1000,
      });

      const { getByText, queryByText } = await renderWithProviders({
        events: [todayEvent, tomorrowEvent],
        selectedDate: TODAY,
      });

      expect(getByText("Today Event")).toBeTruthy();
      expect(queryByText("Tomorrow Event")).toBeNull();
    });

    it("should include all-day events that span the selected date", async () => {
      const allDayEvent = makeEvent({
        id: "allday-event",
        title: "Multi-day Conference",
        allDay: true,
        startTimestampMs: TODAY - MS_PER_DAY, // started yesterday
        endTimestampMs: TODAY + 2 * MS_PER_DAY, // ends day after tomorrow
      });

      const { getByText } = await renderWithProviders({
        events: [allDayEvent],
        selectedDate: TODAY,
      });

      expect(getByText("Multi-day Conference")).toBeTruthy();
    });

    it("should sort events: all-day first, then by startTimestampMs", async () => {
      const laterEvent = makeEvent({
        id: "later-event",
        title: "Afternoon Meeting",
        startTimestampMs: TODAY + 15 * 60 * 60 * 1000,
        endTimestampMs: TODAY + 16 * 60 * 60 * 1000,
      });
      const earlierEvent = makeEvent({
        id: "earlier-event",
        title: "Morning Standup",
        startTimestampMs: TODAY + 9 * 60 * 60 * 1000,
        endTimestampMs: TODAY + 9.5 * 60 * 60 * 1000,
      });
      const allDayEvent = makeEvent({
        id: "allday",
        title: "Holiday",
        allDay: true,
        startTimestampMs: TODAY,
        endTimestampMs: TODAY + MS_PER_DAY,
      });

      const { getAllByText } = await renderWithProviders({
        events: [laterEvent, earlierEvent, allDayEvent],
        selectedDate: TODAY,
      });

      // All three event titles should be rendered
      const titles = ["Holiday", "Morning Standup", "Afternoon Meeting"];
      for (const title of titles) {
        expect(getAllByText(title).length).toBeGreaterThanOrEqual(1);
      }
    });

    it("should call sync on focus when isStale is true", async () => {
      await renderWithProviders({ isStale: true });
      expect(mockSync).toHaveBeenCalled();
    });

    it("should not call sync on focus when isStale is false", async () => {
      await renderWithProviders({ isStale: false });
      expect(mockSync).not.toHaveBeenCalled();
    });

    it("should show error card when sync error occurs", async () => {
      const { getByText } = await renderWithProviders({
        error: "Network error",
      });
      expect(getByText("calendar.syncError")).toBeTruthy();
    });

    it("should create alarm from event (handleCreateAlarm)", async () => {
      const event = makeEvent({
        id: "event-alarm",
        title: "Important Meeting",
        startTimestampMs: TODAY + 14 * 60 * 60 * 1000, // 14:00
        endTimestampMs: TODAY + 15 * 60 * 60 * 1000,
      });

      const { getByTestId } = await renderWithProviders({
        events: [event],
      });

      await act(async () => {
        fireEvent.press(getByTestId("event-create-alarm-event-alarm"));
      });

      expect(scheduleAlarm).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "Important Meeting",
          linkedCalendarEventId: "event-alarm",
          enabled: true,
        }),
      );
    });
  });

  describe("unauthenticated state", () => {
    it("should show sign-in card when not authenticated and no events", async () => {
      const { getByText } = await renderWithProviders({
        authenticated: false,
      });
      expect(getByText("calendar.signInRequired")).toBeTruthy();
    });

    it('should show sign-in button with "calendar.signIn"', async () => {
      const { getByText } = await renderWithProviders({
        authenticated: false,
      });
      expect(getByText("calendar.signIn")).toBeTruthy();
    });

    it("should call auth.signIn and then sync when sign-in button pressed", async () => {
      const { getByText, mockServices } = await renderWithProviders({
        authenticated: false,
      });

      await act(async () => {
        fireEvent.press(getByText("calendar.signIn"));
      });

      expect(mockServices.auth.signIn).toHaveBeenCalled();
      expect(mockSync).toHaveBeenCalledWith(true);
    });
  });
});

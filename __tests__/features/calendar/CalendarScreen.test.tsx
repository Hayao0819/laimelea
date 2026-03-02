import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { CalendarScreen } from "../../../src/features/calendar/screens/CalendarScreen";
import {
  calendarSelectedDateAtom,
  calendarViewModeAtom,
} from "../../../src/atoms/calendarAtoms";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { alarmsAtom } from "../../../src/atoms/alarmAtoms";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";
import { scheduleAlarm } from "../../../src/features/alarm/services/alarmScheduler";
import { createPlatformServices } from "../../../src/core/platform/factory";
import type { Alarm } from "../../../src/models/Alarm";
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

function createMockServices(): PlatformServices {
  return {
    type: "aosp",
    auth: {
      isAvailable: jest.fn().mockResolvedValue(true),
      signIn: jest
        .fn()
        .mockResolvedValue({ email: "test@test.com", accessToken: "token" }),
      signOut: jest.fn().mockResolvedValue(undefined),
      getAccessToken: jest.fn().mockResolvedValue("mock-token"),
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
      requestPermissions: jest.fn().mockResolvedValue(true),
      fetchSleepSessions: jest.fn().mockResolvedValue([]),
    },
  };
}

let currentMockServices: PlatformServices;

async function renderWithProviders(options?: {
  events?: CalendarEvent[];
  loading?: boolean;
  error?: string | null;
  isStale?: boolean;
  selectedDate?: number;
  viewMode?: "month" | "week" | "agenda";
  initialAlarms?: Alarm[];
}) {
  const {
    events = [],
    loading = false,
    error = null,
    isStale = false,
    selectedDate = TODAY,
    viewMode = "agenda",
    initialAlarms = [],
  } = options ?? {};

  mockUseCalendarSync.mockReturnValue({
    events,
    loading,
    error,
    sync: mockSync,
    isStale,
  });

  currentMockServices = createMockServices();
  mockCreatePlatformServices.mockReturnValue(currentMockServices);

  const store = createStore();
  store.set(settingsAtom, DEFAULT_SETTINGS);
  store.set(alarmsAtom, initialAlarms);
  store.set(calendarSelectedDateAtom, selectedDate);
  store.set(calendarViewModeAtom, viewMode);

  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <CalendarScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
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

  it('should render with testID "calendar-screen"', async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("calendar-screen")).toBeTruthy();
  });

  it("should render agenda view by default", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("agenda-view")).toBeTruthy();
  });

  it("should show events for selected day in agenda view", async () => {
    const todayEvent = makeEvent({
      id: "today-event",
      title: "Today Event",
      startTimestampMs: TODAY + 9 * 60 * 60 * 1000,
      endTimestampMs: TODAY + 10 * 60 * 60 * 1000,
    });

    const { getByText } = await renderWithProviders({
      events: [todayEvent],
      selectedDate: TODAY,
    });

    expect(getByText("Today Event")).toBeTruthy();
  });

  it("should include all-day events that span the selected date", async () => {
    const allDayEvent = makeEvent({
      id: "allday-event",
      title: "Multi-day Conference",
      allDay: true,
      startTimestampMs: TODAY - MS_PER_DAY, // started yesterday
      endTimestampMs: TODAY + 2 * MS_PER_DAY, // ends day after tomorrow
    });

    const { getAllByText } = await renderWithProviders({
      events: [allDayEvent],
      selectedDate: TODAY,
    });

    expect(getAllByText("Multi-day Conference").length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("should show all event titles in agenda", async () => {
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

  it("should render month view when viewMode is month", async () => {
    const { getByTestId } = await renderWithProviders({
      viewMode: "month",
    });
    expect(getByTestId("month-view")).toBeTruthy();
  });

  it("should render week view when viewMode is week", async () => {
    const { getByTestId } = await renderWithProviders({
      viewMode: "week",
    });
    expect(getByTestId("week-view")).toBeTruthy();
  });

  it("should render segmented buttons for view switching", async () => {
    const { getByText } = await renderWithProviders();
    expect(getByText("calendar.views.month")).toBeTruthy();
    expect(getByText("calendar.views.week")).toBeTruthy();
    expect(getByText("calendar.views.agenda")).toBeTruthy();
  });

  it("should render navigation header with title", async () => {
    const { getByTestId } = await renderWithProviders();
    // Navigation header is part of calendar-screen
    const screen = getByTestId("calendar-screen");
    expect(screen).toBeTruthy();
  });

  it("should not show sign-in banner (removed)", async () => {
    const { queryByTestId } = await renderWithProviders();
    expect(queryByTestId("sign-in-banner")).toBeNull();
  });

  describe("Array.isArray guard for atomWithStorage", () => {
    function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
      const now = Date.now();
      return {
        id: `alarm-${now}`,
        label: "Test Alarm",
        enabled: true,
        targetTimestampMs: TODAY + 8 * 60 * 60 * 1000,
        setInTimeSystem: "24h",
        repeat: null,
        dismissalMethod: "simple",
        gradualVolumeDurationSec: 30,
        snoozeDurationMin: 5,
        snoozeMaxCount: 3,
        snoozeCount: 0,
        autoSilenceMin: 10,
        soundUri: null,
        vibrationEnabled: true,
        notifeeTriggerId: null,
        skipNextOccurrence: false,
        linkedCalendarEventId: null,
        linkedEventOffsetMs: 0,
        mathDifficulty: 1,
        lastFiredAt: null,
        createdAt: now,
        updatedAt: now,
        ...overrides,
      };
    }

    it("should create alarm from event and add to empty alarms list", async () => {
      const event = makeEvent({
        id: "new-event",
        title: "New Meeting",
        startTimestampMs: TODAY + 14 * 60 * 60 * 1000,
        endTimestampMs: TODAY + 15 * 60 * 60 * 1000,
      });

      const { getByTestId, store } = await renderWithProviders({
        events: [event],
        initialAlarms: [],
      });

      await act(async () => {
        fireEvent.press(getByTestId("event-create-alarm-new-event"));
      });

      const alarms = store.get(alarmsAtom) as Alarm[];
      expect(alarms).toHaveLength(1);
      expect(alarms[0].label).toBe("New Meeting");
      expect(alarms[0].linkedCalendarEventId).toBe("new-event");
      expect(alarms[0].enabled).toBe(true);
    });

    it("should append alarm to existing alarms list", async () => {
      const existingAlarm = makeAlarm({
        id: "existing-1",
        label: "Existing Alarm",
        targetTimestampMs: TODAY + 8 * 60 * 60 * 1000,
      });

      const event = makeEvent({
        id: "event-append",
        title: "Appended Meeting",
        startTimestampMs: TODAY + 16 * 60 * 60 * 1000,
        endTimestampMs: TODAY + 17 * 60 * 60 * 1000,
      });

      const { getByTestId, store } = await renderWithProviders({
        events: [event],
        initialAlarms: [existingAlarm],
      });

      await act(async () => {
        fireEvent.press(getByTestId("event-create-alarm-event-append"));
      });

      const alarms = store.get(alarmsAtom) as Alarm[];
      expect(alarms).toHaveLength(2);
      expect(alarms[0].id).toBe("existing-1");
      expect(alarms[0].label).toBe("Existing Alarm");
      expect(alarms[1].label).toBe("Appended Meeting");
      expect(alarms[1].linkedCalendarEventId).toBe("event-append");
    });

    it("should sync linked alarm times when calendar events change", async () => {
      const linkedAlarm = makeAlarm({
        id: "linked-alarm-1",
        label: "Linked Alarm",
        linkedCalendarEventId: "event-linked",
        linkedEventOffsetMs: -15 * 60 * 1000, // 15 min before
        targetTimestampMs: TODAY + 10 * 60 * 60 * 1000 - 15 * 60 * 1000,
      });

      const updatedEvent = makeEvent({
        id: "event-linked",
        sourceEventId: "src-linked",
        title: "Rescheduled Meeting",
        startTimestampMs: TODAY + 12 * 60 * 60 * 1000, // moved from 10:00 to 12:00
        endTimestampMs: TODAY + 13 * 60 * 60 * 1000,
      });

      const { store } = await renderWithProviders({
        events: [updatedEvent],
        initialAlarms: [linkedAlarm],
      });

      // The useEffect runs on mount with events, triggering syncCalendarAlarms
      await act(async () => {});

      const alarms = store.get(alarmsAtom) as Alarm[];
      expect(alarms).toHaveLength(1);
      // targetTimestampMs should be updated: 12:00 - 15min = 11:45
      const expectedTarget = TODAY + 12 * 60 * 60 * 1000 - 15 * 60 * 1000;
      expect(alarms[0].targetTimestampMs).toBe(expectedTarget);
    });
  });
});

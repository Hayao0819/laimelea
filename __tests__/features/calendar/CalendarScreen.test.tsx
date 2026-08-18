import {
  act,
  cleanup,
  fireEvent,
  renderAsync,
  waitFor,
} from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { alarmsAtom } from "../../../src/atoms/alarmAtoms";
import {
  calendarEventsAtom,
  calendarLastSyncAtom,
  calendarSelectedDateAtom,
  calendarViewModeAtom,
} from "../../../src/atoms/calendarAtoms";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { createPlatformServices } from "../../../src/core/platform/factory";
import type { PlatformServices } from "../../../src/core/platform/types";
import {
  cancelAlarm,
  recoverAlarmSchedule,
  scheduleAlarm,
} from "../../../src/features/alarm/services/alarmScheduler";
import { CalendarScreen } from "../../../src/features/calendar/screens/CalendarScreen";
import type { Alarm } from "../../../src/models/Alarm";
import type { CalendarEvent } from "../../../src/models/CalendarEvent";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, right: 20, bottom: 34, left: 12 },
};

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

jest.mock("../../../src/core/storage/asyncStorageAdapter", () => ({
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
  cancelAlarm: jest.fn().mockResolvedValue(undefined),
  recoverAlarmSchedule: jest.fn(async (alarm: Alarm) => ({
    ...alarm,
    notifeeTriggerId: "trigger-id",
  })),
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
      requestPermissions: jest.fn().mockResolvedValue(true),
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
  hasSynced?: boolean;
}) {
  const {
    events = [],
    loading = false,
    error = null,
    isStale = false,
    selectedDate = TODAY,
    viewMode = "agenda",
    initialAlarms = [],
    hasSynced = true,
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
  store.set(calendarEventsAtom, events);
  store.set(calendarLastSyncAtom, hasSynced ? Date.now() : null);
  store.set(calendarSelectedDateAtom, selectedDate);
  store.set(calendarViewModeAtom, viewMode);

  const utils = await renderAsync(
    <JotaiProvider store={store}>
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>
        <PaperProvider>
          <CalendarScreen />
        </PaperProvider>
      </SafeAreaProvider>
    </JotaiProvider>,
  );
  renderedScreens.push(utils);

  return { ...utils, store, mockServices: currentMockServices };
}

const originalConsoleError = console.error;
const renderedScreens: Array<Awaited<ReturnType<typeof renderAsync>>> = [];

beforeEach(() => {
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (msg.includes("suspended inside an `act` scope")) return;
    if (msg.includes("suspended resource finished loading")) return;
    originalConsoleError(...args);
  };
});

afterEach(async () => {
  for (const screen of renderedScreens.splice(0)) {
    await screen.unmountAsync();
  }
  cleanup();
  console.error = originalConsoleError;
});

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
    const futureStart = Date.now() + 60 * 60 * 1000;
    const event = makeEvent({
      id: "event-alarm",
      title: "Important Meeting",
      startTimestampMs: futureStart,
      endTimestampMs: futureStart + 60 * 60 * 1000,
    });

    const { getByTestId, store } = await renderWithProviders({
      events: [event],
      selectedDate: startOfDay(futureStart),
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
    expect((store.get(alarmsAtom) as Alarm[])[0]?.notifeeTriggerId).toBe(
      "trigger-id",
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
      const futureStart = Date.now() + 60 * 60 * 1000;
      const event = makeEvent({
        id: "new-event",
        title: "New Meeting",
        startTimestampMs: futureStart,
        endTimestampMs: futureStart + 60 * 60 * 1000,
      });

      const { getByTestId, store } = await renderWithProviders({
        events: [event],
        initialAlarms: [],
        selectedDate: startOfDay(futureStart),
      });

      await act(async () => {
        fireEvent.press(getByTestId("event-create-alarm-new-event"));
      });

      const alarms = store.get(alarmsAtom) as Alarm[];
      expect(alarms).toHaveLength(1);
      expect(alarms[0].label).toBe("New Meeting");
      expect(alarms[0].linkedCalendarEventId).toBe("new-event");
      expect(alarms[0].enabled).toBe(true);
      expect(alarms[0].notifeeTriggerId).toBe("trigger-id");
    });

    it("should append alarm to existing alarms list", async () => {
      const existingAlarm = makeAlarm({
        id: "existing-1",
        label: "Existing Alarm",
        targetTimestampMs: TODAY + 8 * 60 * 60 * 1000,
      });

      const futureStart = Date.now() + 60 * 60 * 1000;
      const event = makeEvent({
        id: "event-append",
        title: "Appended Meeting",
        startTimestampMs: futureStart,
        endTimestampMs: futureStart + 60 * 60 * 1000,
      });

      const { getByTestId, store } = await renderWithProviders({
        events: [event],
        initialAlarms: [existingAlarm],
        selectedDate: startOfDay(futureStart),
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

    it("does not persist a linked alarm when scheduling fails", async () => {
      const futureStart = Date.now() + 60 * 60 * 1000;
      const event = makeEvent({
        id: "failed-event",
        startTimestampMs: futureStart,
        endTimestampMs: futureStart + 60 * 60 * 1000,
      });
      (scheduleAlarm as jest.Mock).mockRejectedValueOnce(new Error("failed"));

      const { getByTestId, getByText, store } = await renderWithProviders({
        events: [event],
        selectedDate: startOfDay(futureStart),
      });

      await act(async () => {
        fireEvent.press(getByTestId("event-create-alarm-failed-event"));
      });

      expect(store.get(alarmsAtom)).toEqual([]);
      await waitFor(() => {
        expect(getByText("calendar.alarmScheduleFailed")).toBeTruthy();
      });
    });

    it("does not schedule or persist a linked alarm for a past event", async () => {
      const pastStart = Date.now() - 60 * 60 * 1000;
      const event = makeEvent({
        id: "past-event",
        startTimestampMs: pastStart,
        endTimestampMs: pastStart + 30 * 60 * 1000,
      });

      const { getByTestId, getByText, store } = await renderWithProviders({
        events: [event],
        selectedDate: startOfDay(pastStart),
      });

      await act(async () => {
        fireEvent.press(getByTestId("event-create-alarm-past-event"));
      });

      expect(scheduleAlarm).not.toHaveBeenCalled();
      expect(store.get(alarmsAtom)).toEqual([]);
      await waitFor(() => {
        expect(getByText("calendar.alarmTimePassed")).toBeTruthy();
      });
    });

    it("reschedules a linked alarm before persisting its new time", async () => {
      const futureStart = Date.now() + 2 * 60 * 60 * 1000;
      const linkedAlarm = makeAlarm({
        id: "linked-alarm-1",
        label: "Linked Alarm",
        linkedCalendarEventId: "event-linked",
        linkedEventOffsetMs: -15 * 60 * 1000, // 15 min before
        targetTimestampMs: futureStart - 75 * 60 * 1000,
        notifeeTriggerId: "old-trigger-id",
      });

      const updatedEvent = makeEvent({
        id: "event-linked",
        sourceEventId: "src-linked",
        title: "Rescheduled Meeting",
        startTimestampMs: futureStart,
        endTimestampMs: futureStart + 60 * 60 * 1000,
      });

      const { store } = await renderWithProviders({
        events: [updatedEvent],
        initialAlarms: [linkedAlarm],
      });

      await waitFor(() => {
        expect(cancelAlarm).toHaveBeenCalledWith(linkedAlarm);
      });

      const alarms = store.get(alarmsAtom) as Alarm[];
      expect(alarms).toHaveLength(1);
      const expectedTarget = futureStart - 15 * 60 * 1000;
      expect(alarms[0].targetTimestampMs).toBe(expectedTarget);
      expect(alarms[0].notifeeTriggerId).toBe("trigger-id");
      expect(scheduleAlarm).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "linked-alarm-1",
          targetTimestampMs: expectedTarget,
          notifeeTriggerId: null,
        }),
      );
    });

    it("restores the previous schedule and keeps the atom unchanged on update failure", async () => {
      const futureStart = Date.now() + 2 * 60 * 60 * 1000;
      const linkedAlarm = makeAlarm({
        id: "rollback-alarm",
        linkedCalendarEventId: "event-rollback",
        linkedEventOffsetMs: -15 * 60 * 1000,
        targetTimestampMs: futureStart - 75 * 60 * 1000,
        notifeeTriggerId: "old-trigger-id",
      });
      const updatedEvent = makeEvent({
        id: "event-rollback",
        startTimestampMs: futureStart,
        endTimestampMs: futureStart + 60 * 60 * 1000,
      });
      (scheduleAlarm as jest.Mock).mockRejectedValueOnce(new Error("failed"));
      (recoverAlarmSchedule as jest.Mock).mockResolvedValueOnce({
        ...linkedAlarm,
        notifeeTriggerId: "restored-trigger-id",
      });

      const { getByText, store } = await renderWithProviders({
        events: [updatedEvent],
        initialAlarms: [linkedAlarm],
      });

      await waitFor(() => {
        expect(recoverAlarmSchedule).toHaveBeenCalledWith(linkedAlarm);
      });

      expect(scheduleAlarm).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          targetTimestampMs: futureStart - 15 * 60 * 1000,
        }),
      );
      expect(scheduleAlarm).toHaveBeenCalledTimes(1);
      expect(store.get(alarmsAtom)).toEqual([
        { ...linkedAlarm, notifeeTriggerId: "restored-trigger-id" },
      ]);
      expect(getByText("calendar.alarmRescheduleFailed")).toBeTruthy();
    });

    it("updates every linked alarm in one synchronization pass", async () => {
      const firstStart = Date.now() + 3 * 60 * 60 * 1000;
      const secondStart = Date.now() + 4 * 60 * 60 * 1000;
      const firstAlarm = makeAlarm({
        id: "linked-first",
        linkedCalendarEventId: "event-first",
        linkedEventOffsetMs: -5 * 60 * 1000,
        targetTimestampMs: firstStart - 30 * 60 * 1000,
        notifeeTriggerId: "first-old-trigger",
      });
      const secondAlarm = makeAlarm({
        id: "linked-second",
        linkedCalendarEventId: "event-second",
        linkedEventOffsetMs: -10 * 60 * 1000,
        targetTimestampMs: secondStart - 30 * 60 * 1000,
        notifeeTriggerId: "second-old-trigger",
      });
      const firstEvent = makeEvent({
        id: "event-first",
        startTimestampMs: firstStart,
        endTimestampMs: firstStart + 60 * 60 * 1000,
      });
      const secondEvent = makeEvent({
        id: "event-second",
        startTimestampMs: secondStart,
        endTimestampMs: secondStart + 60 * 60 * 1000,
      });
      (scheduleAlarm as jest.Mock)
        .mockResolvedValueOnce("first-new-trigger")
        .mockResolvedValueOnce("second-new-trigger");

      const { store } = await renderWithProviders({
        events: [firstEvent, secondEvent],
        initialAlarms: [firstAlarm, secondAlarm],
      });

      await waitFor(() => {
        expect(scheduleAlarm).toHaveBeenCalledTimes(2);
      });

      expect(store.get(alarmsAtom)).toEqual([
        expect.objectContaining({
          id: "linked-first",
          targetTimestampMs: firstStart - 5 * 60 * 1000,
          notifeeTriggerId: "first-new-trigger",
        }),
        expect.objectContaining({
          id: "linked-second",
          targetTimestampMs: secondStart - 10 * 60 * 1000,
          notifeeTriggerId: "second-new-trigger",
        }),
      ]);
    });

    it("updates a disabled linked alarm without scheduling it", async () => {
      const futureStart = Date.now() + 2 * 60 * 60 * 1000;
      const linkedAlarm = makeAlarm({
        id: "disabled-linked-alarm",
        enabled: false,
        linkedCalendarEventId: "disabled-event",
        targetTimestampMs: futureStart - 60 * 60 * 1000,
      });
      const event = makeEvent({
        id: "disabled-event",
        startTimestampMs: futureStart,
        endTimestampMs: futureStart + 60 * 60 * 1000,
      });

      const { store } = await renderWithProviders({
        events: [event],
        initialAlarms: [linkedAlarm],
      });

      await waitFor(() => {
        expect((store.get(alarmsAtom) as Alarm[])[0].targetTimestampMs).toBe(
          futureStart,
        );
      });
      expect(cancelAlarm).not.toHaveBeenCalled();
      expect(scheduleAlarm).not.toHaveBeenCalled();
      expect((store.get(alarmsAtom) as Alarm[])[0].enabled).toBe(false);
    });

    it("cancels a linked alarm when its event moves into the past", async () => {
      const linkedAlarm = makeAlarm({
        id: "past-linked-alarm",
        linkedCalendarEventId: "past-linked-event",
        targetTimestampMs: Date.now() + 60 * 60 * 1000,
        notifeeTriggerId: "old-trigger",
      });
      const pastStart = Date.now() - 60 * 60 * 1000;
      const event = makeEvent({
        id: "past-linked-event",
        startTimestampMs: pastStart,
        endTimestampMs: pastStart + 30 * 60 * 1000,
      });

      const { getByText, store } = await renderWithProviders({
        events: [event],
        initialAlarms: [linkedAlarm],
      });

      await waitFor(() => {
        expect(cancelAlarm).toHaveBeenCalledWith(linkedAlarm);
      });
      expect(scheduleAlarm).not.toHaveBeenCalled();
      expect(store.get(alarmsAtom)).toEqual([
        expect.objectContaining({
          id: "past-linked-alarm",
          enabled: false,
          targetTimestampMs: pastStart,
          notifeeTriggerId: null,
        }),
      ]);
      expect(getByText("calendar.alarmTimePassed")).toBeTruthy();
    });

    it("disables a linked alarm after a synced calendar becomes empty", async () => {
      const linkedAlarm = makeAlarm({
        id: "deleted-event-alarm",
        linkedCalendarEventId: "deleted-event",
        notifeeTriggerId: "deleted-event-trigger",
      });

      const { getByText, store } = await renderWithProviders({
        events: [],
        initialAlarms: [linkedAlarm],
      });

      await waitFor(() => {
        expect(cancelAlarm).toHaveBeenCalledWith(linkedAlarm);
      });
      expect(store.get(alarmsAtom)).toEqual([
        expect.objectContaining({
          id: "deleted-event-alarm",
          enabled: false,
          notifeeTriggerId: null,
        }),
      ]);
      expect(getByText("calendar.alarmEventRemoved")).toBeTruthy();
    });

    it("disables only the alarm whose event was removed", async () => {
      const remainingEvent = makeEvent({
        id: "remaining-event",
        startTimestampMs: Date.now() + 60 * 60 * 1000,
      });
      const removedAlarm = makeAlarm({
        id: "removed-alarm",
        linkedCalendarEventId: "removed-event",
        notifeeTriggerId: "removed-trigger",
      });
      const remainingAlarm = makeAlarm({
        id: "remaining-alarm",
        linkedCalendarEventId: remainingEvent.id,
        linkedCalendarSourceEventId: remainingEvent.sourceEventId,
        targetTimestampMs: remainingEvent.startTimestampMs,
        notifeeTriggerId: "remaining-trigger",
      });

      const { store } = await renderWithProviders({
        events: [remainingEvent],
        initialAlarms: [removedAlarm, remainingAlarm],
      });

      await waitFor(() => {
        expect(cancelAlarm).toHaveBeenCalledWith(removedAlarm);
      });
      expect(cancelAlarm).not.toHaveBeenCalledWith(remainingAlarm);
      expect(store.get(alarmsAtom)).toEqual([
        expect.objectContaining({ id: "removed-alarm", enabled: false }),
        remainingAlarm,
      ]);
    });

    it("keeps linked alarms before the first successful calendar sync", async () => {
      const linkedAlarm = makeAlarm({
        id: "not-loaded-alarm",
        linkedCalendarEventId: "not-loaded-event",
        notifeeTriggerId: "not-loaded-trigger",
      });

      const { store } = await renderWithProviders({
        events: [],
        initialAlarms: [linkedAlarm],
        hasSynced: false,
      });

      expect(cancelAlarm).not.toHaveBeenCalled();
      expect(store.get(alarmsAtom)).toEqual([linkedAlarm]);
    });

    it("keeps linked alarms outside the fetched calendar window", async () => {
      const linkedAlarm = makeAlarm({
        id: "outside-window-alarm",
        linkedCalendarEventId: "outside-window-event",
        targetTimestampMs: Date.now() + 30 * MS_PER_DAY,
        notifeeTriggerId: "outside-window-trigger",
      });

      const { store } = await renderWithProviders({
        events: [],
        initialAlarms: [linkedAlarm],
      });

      expect(cancelAlarm).not.toHaveBeenCalled();
      expect(store.get(alarmsAtom)).toEqual([linkedAlarm]);
    });

    it("restores a newer edit when calendar synchronization becomes stale", async () => {
      const eventStart = Date.now() + 3 * 60 * 60 * 1000;
      const linkedAlarm = makeAlarm({
        id: "concurrent-linked-alarm",
        linkedCalendarEventId: "concurrent-event",
        targetTimestampMs: eventStart - 60 * 60 * 1000,
        notifeeTriggerId: "old-trigger",
      });
      const event = makeEvent({
        id: "concurrent-event",
        startTimestampMs: eventStart,
        endTimestampMs: eventStart + 60 * 60 * 1000,
      });
      let finishCalendarSchedule: ((triggerId: string) => void) | undefined;
      (scheduleAlarm as jest.Mock).mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            finishCalendarSchedule = resolve;
          }),
      );

      const { store } = await renderWithProviders({
        events: [event],
        initialAlarms: [linkedAlarm],
      });
      await waitFor(() => {
        expect(scheduleAlarm).toHaveBeenCalledTimes(1);
      });

      const editedAlarm = {
        ...linkedAlarm,
        linkedCalendarEventId: null,
        targetTimestampMs: eventStart + 2 * 60 * 60 * 1000,
        notifeeTriggerId: "edited-trigger",
      };
      act(() => {
        store.set(alarmsAtom, [editedAlarm]);
      });
      await act(async () => {
        finishCalendarSchedule?.("stale-calendar-trigger");
      });

      await waitFor(() => {
        expect(scheduleAlarm).toHaveBeenCalledTimes(2);
      });
      expect(scheduleAlarm).toHaveBeenLastCalledWith(editedAlarm);
      expect(store.get(alarmsAtom)).toEqual([
        { ...editedAlarm, notifeeTriggerId: "trigger-id" },
      ]);
    });
  });
});

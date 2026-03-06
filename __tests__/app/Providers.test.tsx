import { act, render, waitFor } from "@testing-library/react-native";
import { atom, createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { AppState, type AppStateStatus, Text } from "react-native";

import {
  createAlarmChannel,
  createTimerChannel,
  ensureNotificationPermissions,
} from "../../src/core/notifications/notifeeSetup";
import { rescheduleAllEnabledAlarms } from "../../src/features/alarm/services/alarmRescheduler";
import type { Alarm } from "../../src/models/Alarm";
import { DEFAULT_SETTINGS } from "../../src/models/Settings";

// Create simple synchronous atoms to avoid suspension from atomWithStorage
const mockAlarmsAtom = atom<Alarm[]>([]);
const mockSettingsAtom = atom(DEFAULT_SETTINGS);

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../../src/atoms/alarmAtoms", () => ({
  get alarmsAtom() {
    return mockAlarmsAtom;
  },
}));

jest.mock("../../src/atoms/settingsAtoms", () => ({
  get settingsAtom() {
    return mockSettingsAtom;
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: jest.fn() },
  }),
}));

jest.mock("../../src/core/i18n", () => ({
  __esModule: true,
  default: { language: "en", changeLanguage: jest.fn() },
  resolveLanguage: (lang: string) => (lang === "auto" ? "en" : lang),
}));

const mockGetInitialNotification = jest.fn().mockResolvedValue(null);
jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    getInitialNotification: mockGetInitialNotification,
    onForegroundEvent: jest.fn().mockReturnValue(jest.fn()),
    onBackgroundEvent: jest.fn(),
  },
  EventType: { PRESS: 1, ACTION_PRESS: 7, DISMISSED: 2 },
}));

const mockForegroundUnsubscribe = jest.fn();
jest.mock("../../src/core/notifications/foregroundHandler", () => ({
  setupForegroundHandler: jest
    .fn()
    .mockReturnValue(mockForegroundUnsubscribe),
}));

jest.mock("../../src/core/notifications/notifeeSetup", () => ({
  createAlarmChannel: jest.fn(),
  createTimerChannel: jest.fn(),
  ensureNotificationPermissions: jest.fn(),
  ALARM_CHANNEL_ID: "alarm",
  TIMER_CHANNEL_ID: "timer",
}));

jest.mock("../../src/features/alarm/services/alarmRescheduler", () => ({
  rescheduleAllEnabledAlarms: jest.fn(),
}));

jest.mock("../../src/core/platform/detection", () => ({
  detectPlatform: jest.fn(() => Promise.resolve("aosp")),
}));

jest.mock("../../src/atoms/platformAtoms", () => {
  const { atom: jotaiAtom } = require("jotai");
  return { platformTypeAtom: jotaiAtom("aosp") };
});

const mockNavigate = jest.fn();
const mockIsReady = jest.fn().mockReturnValue(true);
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  createNavigationContainerRef: () => ({
    isReady: mockIsReady,
    navigate: mockNavigate,
    current: {},
  }),
  NavigationContainer: ({
    children,
  }: {
    children: React.ReactNode;
     
    [key: string]: any;
  }) => children,
}));

// Import after mocks
const {
  setupForegroundHandler,
} = require("../../src/core/notifications/foregroundHandler");

// Import Providers after all mocks are set up
const { Providers } = require("../../src/app/Providers");

// Track AppState.addEventListener calls
let appStateCallback: ((state: AppStateStatus) => void) | null = null;
const mockRemove = jest.fn();

jest
  .spyOn(AppState, "addEventListener")
  .mockImplementation(
    (_type: string, listener: (state: AppStateStatus) => void) => {
      appStateCallback = listener;
      return { remove: mockRemove };
    },
  );

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "test-alarm-1",
    label: "Morning Alarm",
    enabled: true,
    targetTimestampMs: Date.now() + 3600000,
    setInTimeSystem: "custom",
    repeat: null,
    dismissalMethod: "simple",
    gradualVolumeDurationSec: 30,
    snoozeDurationMin: 5,
    snoozeMaxCount: 3,
    snoozeCount: 0,
    autoSilenceMin: 15,
    soundUri: null,
    vibrationEnabled: true,
    notifeeTriggerId: null,
    skipNextOccurrence: false,
    linkedCalendarEventId: null,
    linkedEventOffsetMs: 0,
    mathDifficulty: 1,
    lastFiredAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function renderProviders(store = createStore(), initialAlarms: Alarm[] = []) {
  store.set(mockSettingsAtom, DEFAULT_SETTINGS);
  store.set(mockAlarmsAtom, initialAlarms);
  return render(
    <JotaiProvider store={store}>
      <Providers>
        <Text>child</Text>
      </Providers>
    </JotaiProvider>,
  );
}

describe("Providers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateCallback = null;
    // Restore mock return values after clearAllMocks
    mockIsReady.mockReturnValue(true);
    mockGetInitialNotification.mockResolvedValue(null);
    (setupForegroundHandler as jest.Mock).mockReturnValue(
      mockForegroundUnsubscribe,
    );
    // Restore spy implementation after clearAllMocks
    (AppState.addEventListener as jest.Mock).mockImplementation(
      (_type: string, listener: (state: AppStateStatus) => void) => {
        appStateCallback = listener;
        return { remove: mockRemove };
      },
    );
  });

  describe("alarm rescheduling", () => {
    it("calls rescheduleAllEnabledAlarms on mount", async () => {
      const alarms = [makeAlarm()];
      await renderProviders(createStore(), alarms);

      expect(rescheduleAllEnabledAlarms).toHaveBeenCalledWith(alarms);
    });

    it("calls rescheduleAllEnabledAlarms when AppState changes to active", async () => {
      const alarms = [makeAlarm()];
      await renderProviders(createStore(), alarms);

      (rescheduleAllEnabledAlarms as jest.Mock).mockClear();

      await act(async () => {
        appStateCallback?.("active");
      });

      expect(rescheduleAllEnabledAlarms).toHaveBeenCalledWith(alarms);
    });

    it("does not call reschedule when AppState changes to background", async () => {
      const alarms = [makeAlarm()];
      await renderProviders(createStore(), alarms);

      (rescheduleAllEnabledAlarms as jest.Mock).mockClear();

      await act(async () => {
        appStateCallback?.("background");
      });

      expect(rescheduleAllEnabledAlarms).not.toHaveBeenCalled();
    });

    it("removes AppState listener on unmount", async () => {
      const alarms = [makeAlarm()];
      const { unmount } = await renderProviders(createStore(), alarms);

      expect(AppState.addEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
      expect(mockRemove).not.toHaveBeenCalled();

      unmount();

      expect(mockRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe("initialization", () => {
    it("creates alarm and timer notification channels", async () => {
      await renderProviders();

      await waitFor(() => {
        expect(createAlarmChannel).toHaveBeenCalledTimes(1);
        expect(createTimerChannel).toHaveBeenCalledTimes(1);
      });
    });

    it("requests notification permissions", async () => {
      await renderProviders();

      await waitFor(() => {
        expect(ensureNotificationPermissions).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("foreground notification handler", () => {
    it("registers setupForegroundHandler on mount", async () => {
      await renderProviders();

      expect(setupForegroundHandler).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("unsubscribes foreground handler on unmount", async () => {
      const { unmount } = await renderProviders();

      expect(mockForegroundUnsubscribe).not.toHaveBeenCalled();
      unmount();
      expect(mockForegroundUnsubscribe).toHaveBeenCalled();
    });

    it("navigates to AlarmFiring when foreground handler fires", async () => {
      await renderProviders();

      const handler = (setupForegroundHandler as jest.Mock).mock.calls[0][0];
      handler("alarm-abc");

      expect(mockNavigate).toHaveBeenCalledWith("AlarmFiring", {
        alarmId: "alarm-abc",
      });
    });

    it("does not navigate when navigation is not ready", async () => {
      mockIsReady.mockReturnValue(false);
      await renderProviders();

      const handler = (setupForegroundHandler as jest.Mock).mock.calls[0][0];
      handler("alarm-abc");

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("initial notification", () => {
    it("does nothing when there is no initial notification", async () => {
      mockGetInitialNotification.mockResolvedValue(null);
      await renderProviders();

      await act(async () => {});
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("navigates to AlarmFiring when launched from alarm notification", async () => {
      mockGetInitialNotification.mockResolvedValue({
        notification: { data: { alarmId: "alarm-from-notification" } },
      });

      await renderProviders();

      // The checkInitialNotification function resolves the promise and
      // sets up a 100ms interval that polls navigationRef.isReady().
      // Wait for the interval to fire and navigate.
      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith("AlarmFiring", {
            alarmId: "alarm-from-notification",
          });
        },
        { timeout: 3000 },
      );
    });

    it("does not navigate when initial notification has no alarmId", async () => {
      mockGetInitialNotification.mockResolvedValue({
        notification: { data: {} },
      });

      await renderProviders();

      await act(async () => {});
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});

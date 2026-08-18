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
  get resolvedSettingsAtom() {
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
  setupForegroundHandler: jest.fn().mockReturnValue(mockForegroundUnsubscribe),
}));

const mockConsumeNativeAlarmDeliveries = jest.fn().mockResolvedValue([]);
const mockAcknowledgeNativeAlarmDeliveries = jest
  .fn()
  .mockResolvedValue(undefined);
jest.mock("../../src/features/alarm/services/ringtoneService", () => ({
  consumeNativeAlarmDeliveries: mockConsumeNativeAlarmDeliveries,
  acknowledgeNativeAlarmDeliveries: mockAcknowledgeNativeAlarmDeliveries,
}));

const mockProcessAlarmDelivery = jest.fn().mockResolvedValue({
  handled: false,
  alarms: null,
  updatedAlarm: null,
  rescheduleFailed: false,
});
jest.mock("../../src/features/alarm/services/alarmDeliveryService", () => ({
  processAlarmDelivery: mockProcessAlarmDelivery,
}));

jest.mock("../../src/core/notifications/notifeeSetup", () => ({
  createAlarmChannel: jest.fn(),
  createTimerChannel: jest.fn(),
  ensureNotificationPermissions: jest.fn(),
  ALARM_CHANNEL_ID: "alarm",
  TIMER_CHANNEL_ID: "timer",
}));

jest.mock("../../src/features/alarm/services/alarmRescheduler", () => ({
  rescheduleAllEnabledAlarms: jest.fn((alarms: Alarm[]) =>
    Promise.resolve(alarms),
  ),
}));

jest.mock("../../src/core/platform/detection", () => ({
  detectPlatform: jest.fn(() => Promise.resolve("aosp")),
}));

jest.mock("../../src/features/settings/services/restoreTransaction", () => ({
  recoverPendingBackupRestore: jest.fn(() => Promise.resolve(false)),
}));

jest.mock("../../src/atoms/platformAtoms", () => {
  const { atom: jotaiAtom } = require("jotai");
  return { platformTypeAtom: jotaiAtom("aosp") };
});

const mockNavigate = jest.fn();
const mockIsReady = jest.fn().mockReturnValue(true);
const mockGetCurrentRoute = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(false);
const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  createNavigationContainerRef: () => ({
    isReady: mockIsReady,
    navigate: mockNavigate,
    getCurrentRoute: mockGetCurrentRoute,
    canGoBack: mockCanGoBack,
    goBack: mockGoBack,
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
const {
  recoverPendingBackupRestore,
} = require("../../src/features/settings/services/restoreTransaction");

// Import Providers after all mocks are set up
const { Providers } = require("../../src/app/Providers");

// Track AppState.addEventListener calls
let appStateCallback: ((state: AppStateStatus) => void) | null = null;
const mockRemove = jest.fn();

jest
  .spyOn(AppState, "addEventListener")
  .mockImplementation(
    (_type: string, listener: (state: AppStateStatus) => void) => {
      appStateCallback ??= listener;
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

async function renderProviders(
  store = createStore(),
  initialAlarms: Alarm[] = [],
) {
  store.set(mockSettingsAtom, DEFAULT_SETTINGS);
  store.set(mockAlarmsAtom, initialAlarms);
  const result = render(
    <JotaiProvider store={store}>
      <Providers>
        <Text>child</Text>
      </Providers>
    </JotaiProvider>,
  );
  await act(async () => {});
  return result;
}

describe("Providers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateCallback = null;
    // Restore mock return values after clearAllMocks
    mockIsReady.mockReturnValue(true);
    mockGetCurrentRoute.mockReturnValue(undefined);
    mockCanGoBack.mockReturnValue(false);
    mockGetInitialNotification.mockResolvedValue(null);
    mockConsumeNativeAlarmDeliveries.mockResolvedValue([]);
    mockProcessAlarmDelivery.mockResolvedValue({
      handled: false,
      alarms: null,
      updatedAlarm: null,
      rescheduleFailed: false,
    });
    (recoverPendingBackupRestore as jest.Mock).mockResolvedValue(null);
    (setupForegroundHandler as jest.Mock).mockReturnValue(
      mockForegroundUnsubscribe,
    );
    // Restore spy implementation after clearAllMocks
    (AppState.addEventListener as jest.Mock).mockImplementation(
      (_type: string, listener: (state: AppStateStatus) => void) => {
        appStateCallback ??= listener;
        return { remove: mockRemove };
      },
    );
  });

  describe("alarm rescheduling", () => {
    it("calls rescheduleAllEnabledAlarms on mount", async () => {
      const alarms = [makeAlarm()];
      await renderProviders(createStore(), alarms);

      await waitFor(() => {
        expect(rescheduleAllEnabledAlarms).toHaveBeenCalledWith(
          alarms,
          DEFAULT_SETTINGS.cycleConfig,
        );
      });
    });

    it("calls rescheduleAllEnabledAlarms when AppState changes to active", async () => {
      const alarms = [makeAlarm()];
      await renderProviders(createStore(), alarms);

      await waitFor(() => {
        expect(rescheduleAllEnabledAlarms).toHaveBeenCalledTimes(1);
      });
      (rescheduleAllEnabledAlarms as jest.Mock).mockClear();

      await act(async () => {
        appStateCallback?.("active");
      });

      expect(rescheduleAllEnabledAlarms).toHaveBeenCalledWith(
        alarms,
        DEFAULT_SETTINGS.cycleConfig,
      );
    });

    it("does not call reschedule when AppState changes to background", async () => {
      const alarms = [makeAlarm()];
      await renderProviders(createStore(), alarms);

      await waitFor(() => {
        expect(rescheduleAllEnabledAlarms).toHaveBeenCalledTimes(1);
      });
      (rescheduleAllEnabledAlarms as jest.Mock).mockClear();

      await act(async () => {
        appStateCallback?.("background");
      });

      expect(rescheduleAllEnabledAlarms).not.toHaveBeenCalled();
    });

    it("removes AppState listener on unmount", async () => {
      const alarms = [makeAlarm()];
      const { unmount } = await renderProviders(createStore(), alarms);

      await waitFor(() => {
        expect(AppState.addEventListener).toHaveBeenCalledWith(
          "change",
          expect.any(Function),
        );
      });
      expect(mockRemove).not.toHaveBeenCalled();

      unmount();

      expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it("does not synchronize alarms after restore recovery fails", async () => {
      (recoverPendingBackupRestore as jest.Mock).mockRejectedValueOnce(
        new Error("recovery failed"),
      );

      await renderProviders(createStore(), [makeAlarm()]);

      expect(rescheduleAllEnabledAlarms).not.toHaveBeenCalled();
      expect(AppState.addEventListener).not.toHaveBeenCalled();
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
        expect.any(Function),
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

    it("updates the alarms atom when a foreground delivery is processed", async () => {
      const store = createStore();
      const alarm = makeAlarm();
      await renderProviders(store, [alarm]);
      const deliveredAlarm = {
        ...alarm,
        targetTimestampMs: alarm.targetTimestampMs + 60_000,
      };
      const onAlarmsUpdated = (setupForegroundHandler as jest.Mock).mock
        .calls[0][1];

      act(() => {
        onAlarmsUpdated([deliveredAlarm]);
      });

      expect(store.get(mockAlarmsAtom)).toEqual([deliveredAlarm]);
    });
  });

  describe("native alarm delivery", () => {
    it("serializes a foreground synchronization that arrives during rescheduling", async () => {
      let finishInitialReschedule: (() => void) | undefined;
      const initialReschedule = new Promise<Alarm[]>((resolve) => {
        finishInitialReschedule = () => resolve([]);
      });
      (rescheduleAllEnabledAlarms as jest.Mock)
        .mockImplementationOnce(() => initialReschedule)
        .mockImplementation(() => Promise.resolve([]));

      await renderProviders();

      await waitFor(() => {
        expect(rescheduleAllEnabledAlarms).toHaveBeenCalledTimes(1);
        expect(mockConsumeNativeAlarmDeliveries).toHaveBeenCalledTimes(1);
      });
      await act(async () => {
        appStateCallback?.("active");
      });
      expect(mockConsumeNativeAlarmDeliveries).toHaveBeenCalledTimes(1);

      await act(async () => {
        finishInitialReschedule?.();
        await initialReschedule;
      });
      await waitFor(() => {
        expect(mockConsumeNativeAlarmDeliveries).toHaveBeenCalledTimes(2);
        expect(rescheduleAllEnabledAlarms).toHaveBeenCalledTimes(2);
      });
    });

    it("processes pending deliveries in occurrence order", async () => {
      const first = {
        deliveryId: "delivery.alarm-1.100",
        alarmId: "alarm-1",
        occurrenceTimestampMs: 100,
        autoSilenceMs: 0,
        stopped: true,
      };
      const second = {
        deliveryId: "delivery.alarm-2.200",
        alarmId: "alarm-2",
        occurrenceTimestampMs: 200,
        autoSilenceMs: 0,
        stopped: true,
      };
      mockConsumeNativeAlarmDeliveries.mockResolvedValueOnce([second, first]);
      mockProcessAlarmDelivery.mockResolvedValue({
        handled: false,
        alarms: [],
        updatedAlarm: null,
        rescheduleFailed: false,
      });

      await renderProviders();

      await waitFor(() => {
        expect(
          mockProcessAlarmDelivery.mock.calls.map(([delivery]) => delivery),
        ).toEqual([first, second]);
      });
    });

    it("processes and acknowledges a stopped alarm without navigating", async () => {
      const alarm = makeAlarm();
      const delivery = {
        deliveryId: "delivery.test-alarm-1.1234",
        alarmId: alarm.id,
        occurrenceTimestampMs: 1234,
        autoSilenceMs: 0,
        stopped: true,
      };
      mockConsumeNativeAlarmDeliveries.mockResolvedValueOnce([delivery]);
      mockProcessAlarmDelivery.mockResolvedValueOnce({
        handled: true,
        alarms: [alarm],
        updatedAlarm: alarm,
        rescheduleFailed: false,
      });

      await renderProviders(createStore(), [alarm]);

      await waitFor(() => {
        expect(mockProcessAlarmDelivery).toHaveBeenCalledWith(
          delivery,
          expect.any(Function),
        );
        expect(mockAcknowledgeNativeAlarmDeliveries).toHaveBeenCalledWith([
          delivery.deliveryId,
        ]);
      });
      expect(mockNavigate).not.toHaveBeenCalledWith("AlarmFiring", {
        alarmId: alarm.id,
      });
    });

    it("navigates after delivery acknowledgement fails", async () => {
      const alarm = makeAlarm();
      const delivery = {
        deliveryId: "delivery.test-alarm-1.1234",
        alarmId: alarm.id,
        occurrenceTimestampMs: 1234,
        autoSilenceMs: 0,
        stopped: false,
      };
      mockConsumeNativeAlarmDeliveries.mockResolvedValueOnce([delivery]);
      mockProcessAlarmDelivery.mockResolvedValueOnce({
        handled: true,
        alarms: [alarm],
        updatedAlarm: alarm,
        rescheduleFailed: false,
      });
      mockAcknowledgeNativeAlarmDeliveries.mockRejectedValueOnce(
        new Error("acknowledgement failed"),
      );

      await renderProviders(createStore(), [alarm]);

      await waitFor(() => {
        expect(mockAcknowledgeNativeAlarmDeliveries).toHaveBeenCalledWith([
          delivery.deliveryId,
        ]);
        expect(mockNavigate).toHaveBeenCalledWith("AlarmFiring", {
          alarmId: alarm.id,
        });
      });
    });

    it("closes the matching firing screen after an external stop", async () => {
      const alarm = makeAlarm();
      const delivery = {
        deliveryId: "delivery.test-alarm-1.1234",
        alarmId: alarm.id,
        occurrenceTimestampMs: 1234,
        autoSilenceMs: 0,
        stopped: true,
      };
      mockConsumeNativeAlarmDeliveries.mockResolvedValueOnce([delivery]);
      mockProcessAlarmDelivery.mockResolvedValueOnce({
        handled: true,
        alarms: [alarm],
        updatedAlarm: alarm,
        rescheduleFailed: false,
      });
      mockGetCurrentRoute.mockReturnValue({
        name: "AlarmFiring",
        params: { alarmId: alarm.id },
      });
      mockCanGoBack.mockReturnValue(true);

      await renderProviders(createStore(), [alarm]);

      await waitFor(() => {
        expect(mockGoBack).toHaveBeenCalledTimes(1);
      });
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

      const { unmount } = await renderProviders();

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

      unmount();
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

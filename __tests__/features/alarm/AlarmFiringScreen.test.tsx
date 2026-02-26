import React from "react";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import notifee from "@notifee/react-native";
import { AlarmFiringScreen } from "../../../src/features/alarm/screens/AlarmFiringScreen";
import { alarmsAtom } from "../../../src/atoms/alarmAtoms";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";
import { scheduleAlarm } from "../../../src/features/alarm/services/alarmScheduler";
import type { Alarm } from "../../../src/models/Alarm";

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
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockAlarmId = "test-alarm-1";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { alarmId: mockAlarmId } }),
}));

jest.mock("@notifee/react-native", () => ({
  __esModule: true,
  default: {
    cancelNotification: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock(
  "../../../src/features/alarm/services/alarmScheduler",
  () => ({
    scheduleAlarm: jest.fn(() => Promise.resolve("trigger-id")),
  }),
);

jest.mock(
  "../../../src/features/alarm/services/gradualVolumeManager",
  () => ({
    GradualVolumeManager: jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
    })),
  }),
);

jest.mock(
  "../../../src/features/alarm/components/dismissal/DismissalContainer",
  () => ({
    DismissalContainer: ({
      onDismiss,
      onSnooze,
      canSnooze,
    }: {
      onDismiss: () => void;
      onSnooze: () => void;
      canSnooze: boolean;
    }) => {
      const ReactNative = require("react-native");
      return (
        <ReactNative.View testID="dismissal-container">
          <ReactNative.Button
            testID="dismiss-button"
            title="Dismiss"
            onPress={onDismiss}
          />
          {canSnooze && (
            <ReactNative.Button
              testID="snooze-button"
              title="Snooze"
              onPress={onSnooze}
            />
          )}
        </ReactNative.View>
      );
    },
  }),
);

jest.mock("../../../src/features/alarm/strategies", () => ({}));

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
    lastFiredAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function renderWithProviders(
  store = createStore(),
  initialAlarms: Alarm[] = [],
) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  store.set(alarmsAtom, initialAlarms);
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <AlarmFiringScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  return { ...utils, store };
}

describe("AlarmFiringScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlarmId = "test-alarm-1";
  });

  it('should render with testID "alarm-firing-screen" when alarm found', async () => {
    const { getByTestId } = await renderWithProviders(createStore(), [
      makeAlarm(),
    ]);
    expect(getByTestId("alarm-firing-screen")).toBeTruthy();
  });

  it("should display alarm label when present", async () => {
    const { getByText } = await renderWithProviders(createStore(), [
      makeAlarm({ label: "Wake Up" }),
    ]);
    expect(getByText("Wake Up")).toBeTruthy();
  });

  it('should display t("alarm.title") when alarm has no label', async () => {
    const { getByText } = await renderWithProviders(createStore(), [
      makeAlarm({ label: "" }),
    ]);
    expect(getByText("alarm.title")).toBeTruthy();
  });

  it("should display time in custom time format", async () => {
    // Use baseTimeMs=0 and a known targetTimestampMs
    // With default cycleConfig (cycleLengthMinutes=1560, baseTimeMs=0)
    // targetTimestampMs = 3 * 3600000 + 30 * 60000 = 12600000 => 03:30
    const { getByText } = await renderWithProviders(createStore(), [
      makeAlarm({ targetTimestampMs: 12600000 }),
    ]);
    expect(getByText("03:30")).toBeTruthy();
  });

  it('should show "Alarm not found" when alarm id doesn\'t match', async () => {
    mockAlarmId = "non-existent-alarm";
    const { getByText, queryByTestId } = await renderWithProviders(
      createStore(),
      [makeAlarm()],
    );
    expect(getByText("Alarm not found")).toBeTruthy();
    expect(queryByTestId("alarm-firing-screen")).toBeNull();
  });

  it("should call notifee.cancelNotification and update alarm on dismiss", async () => {
    const store = createStore();
    const alarm = makeAlarm();
    const { getByTestId } = await renderWithProviders(store, [alarm]);

    await act(async () => {
      fireEvent.press(getByTestId("dismiss-button"));
    });

    await waitFor(() => {
      expect(notifee.cancelNotification).toHaveBeenCalledWith("test-alarm-1");
    });

    // Verify alarms atom was updated with lastFiredAt
    const updatedAlarms = store.get(alarmsAtom);
    expect(updatedAlarms[0].lastFiredAt).not.toBeNull();
    expect(updatedAlarms[0].lastFiredAt).toBeGreaterThan(0);
  });

  it("should navigate back on dismiss", async () => {
    const { getByTestId } = await renderWithProviders(createStore(), [
      makeAlarm(),
    ]);

    await act(async () => {
      fireEvent.press(getByTestId("dismiss-button"));
    });

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it("should schedule snoozed alarm and navigate back on snooze", async () => {
    const store = createStore();
    const { getByTestId } = await renderWithProviders(store, [makeAlarm()]);

    await act(async () => {
      fireEvent.press(getByTestId("snooze-button"));
    });

    await waitFor(() => {
      expect(scheduleAlarm).toHaveBeenCalled();
    });

    // Verify the scheduled alarm has updated targetTimestampMs
    const scheduledArg = (scheduleAlarm as jest.Mock).mock.calls[0][0];
    expect(scheduledArg.targetTimestampMs).toBeGreaterThan(Date.now() - 1000);
    expect(scheduledArg.snoozeCount).toBe(1);

    expect(mockGoBack).toHaveBeenCalled();
  });

  it("should increment snoozeCount on snooze", async () => {
    const store = createStore();
    const alarm = makeAlarm({ snoozeCount: 1 });
    const { getByTestId } = await renderWithProviders(store, [alarm]);

    await act(async () => {
      fireEvent.press(getByTestId("snooze-button"));
    });

    await waitFor(() => {
      const updatedAlarms = store.get(alarmsAtom);
      expect(updatedAlarms[0].snoozeCount).toBe(2);
    });
  });

  it("should pass canSnooze=false to DismissalContainer when snoozeCount >= snoozeMaxCount", async () => {
    // snoozeCount = 3, snoozeMaxCount = 3 => canSnooze = false
    const alarm = makeAlarm({ snoozeCount: 3, snoozeMaxCount: 3 });
    const { queryByTestId } = await renderWithProviders(createStore(), [alarm]);

    // When canSnooze is false, snooze button should not be rendered
    expect(queryByTestId("snooze-button")).toBeNull();
    // Dismiss button should still be present
    expect(queryByTestId("dismiss-button")).toBeTruthy();
  });
});

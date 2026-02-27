import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { BulkAlarmScreen } from "../../../src/features/alarm/screens/BulkAlarmScreen";
import { alarmsAtom } from "../../../src/atoms/alarmAtoms";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";
import { scheduleAlarm } from "../../../src/features/alarm/services/alarmScheduler";
import type { Alarm } from "../../../src/models/Alarm";

jest.mock("react-native-shake", () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock("../../../src/features/widget/services/widgetUpdater", () => ({
  requestClockWidgetUpdate: jest.fn(),
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
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
    i18n: { language: "en" },
  }),
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
  EventType: { PRESS: 1, ACTION_PRESS: 7, DISMISSED: 2 },
}));

const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: mockGoBack,
    setOptions: mockSetOptions,
  }),
}));

jest.mock("../../../src/features/alarm/services/alarmScheduler", () => ({
  scheduleAlarm: jest.fn().mockResolvedValue("trigger-id"),
}));

function renderWithProviders(
  store = createStore(),
  initialAlarms: Alarm[] = [],
) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  store.set(alarmsAtom, initialAlarms);
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <BulkAlarmScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  return { ...utils, store };
}

describe("BulkAlarmScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-27T00:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render with testID "bulk-alarm-screen"', async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("bulk-alarm-screen")).toBeTruthy();
  });

  it("should render BulkAlarmForm", async () => {
    const { getByTestId } = await renderWithProviders();
    // BulkAlarmForm renders interval-input, bulk-label-input, etc.
    expect(getByTestId("interval-input")).toBeTruthy();
    expect(getByTestId("bulk-label-input")).toBeTruthy();
    expect(getByTestId("bulk-dismissal-item")).toBeTruthy();
  });

  it("should set navigation title via setOptions", async () => {
    await renderWithProviders();

    expect(mockSetOptions).toHaveBeenCalled();
    const options = mockSetOptions.mock.calls[0][0];
    expect(options.title).toBe("alarm.bulkCreate");
  });

  it("should render save button in header", async () => {
    await renderWithProviders();

    expect(mockSetOptions).toHaveBeenCalled();
    const options = mockSetOptions.mock.calls[0][0];
    expect(options.headerRight).toBeDefined();
    expect(typeof options.headerRight).toBe("function");

    // Verify the SaveButton renders with the expected testID by calling it directly
    const SaveButton = options.headerRight;
    const element = SaveButton();
    expect(element).toBeTruthy();
    expect(element.props.testID).toBe("bulk-save-button");
  });

  it("should disable save when no preview alarms", async () => {
    // Default interval is "30" and from=07:00, to=09:00 which generates alarms.
    // Set interval to "0" so no alarms are generated.
    const store = createStore();
    store.set(settingsAtom, DEFAULT_SETTINGS);
    store.set(alarmsAtom, []);

    const { getByTestId } = render(
      <JotaiProvider store={store}>
        <PaperProvider>
          <BulkAlarmScreen />
        </PaperProvider>
      </JotaiProvider>,
    );

    // Change interval to 0 to produce no preview alarms
    await act(async () => {
      fireEvent.changeText(getByTestId("interval-input"), "0");
    });

    // Get the latest setOptions call to extract SaveButton
    const lastCall =
      mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
    const SaveButton = lastCall.headerRight;
    const { getByTestId: getSaveById } = render(
      <PaperProvider>
        <SaveButton />
      </PaperProvider>,
    );

    const saveButton = getSaveById("bulk-save-button");
    expect(saveButton.props.accessibilityState?.disabled).toBe(true);
  });

  it("should save alarms and navigate back on save button press", async () => {
    const store = createStore();
    renderWithProviders(store, []);

    // Default state: from=07:00, to=09:00, interval=30
    // This generates 5 alarms (07:00, 07:30, 08:00, 08:30, 09:00)

    // Get the SaveButton from setOptions
    await waitFor(() => {
      expect(mockSetOptions).toHaveBeenCalled();
    });

    const lastCall =
      mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
    const SaveButton = lastCall.headerRight;

    // Render the save button and press it
    const { getByTestId: getSaveById } = render(
      <PaperProvider>
        <SaveButton />
      </PaperProvider>,
    );

    await act(async () => {
      fireEvent.press(getSaveById("bulk-save-button"));
    });

    // scheduleAlarm should have been called for each generated alarm
    await waitFor(() => {
      expect(scheduleAlarm).toHaveBeenCalledTimes(5);
    });

    // Should navigate back after saving
    expect(mockGoBack).toHaveBeenCalled();

    // Alarms should be stored in the atom
    const storedAlarms = store.get(alarmsAtom);
    expect(storedAlarms).toHaveLength(5);
  });
});

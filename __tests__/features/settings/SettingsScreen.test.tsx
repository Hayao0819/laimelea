import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { SettingsScreen } from "../../../src/features/settings/screens/SettingsScreen";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { alarmsAtom } from "../../../src/atoms/alarmAtoms";
import { sleepSessionsAtom } from "../../../src/atoms/sleepAtoms";
import { DEFAULT_SETTINGS } from "../../../src/models/Settings";
import type { Alarm } from "../../../src/models/Alarm";
import type { SleepSession } from "../../../src/models/SleepSession";
import type { PlatformServices } from "../../../src/core/platform/types";

let mockServices: PlatformServices;

jest.mock("../../../src/core/platform/factory", () => ({
  createPlatformServices: () => mockServices,
}));

jest.mock("../../../src/features/widget/services/widgetUpdater", () => ({
  requestClockWidgetUpdate: jest.fn(),
}));

jest.mock("../../../src/core/i18n", () => ({
  __esModule: true,
  default: { language: "en", changeLanguage: jest.fn() },
  resolveLanguage: (setting: string) =>
    setting === "auto" || !["en", "ja"].includes(setting) ? "en" : setting,
  detectSystemLanguage: () => "en",
  SUPPORTED_LANGUAGES: ["ja", "en"],
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

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    getTokens: jest.fn(),
    configure: jest.fn(),
  },
}));

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

const mockAlarm: Alarm = {
  id: "alarm-1",
  label: "Test Alarm",
  enabled: true,
  targetTimestampMs: 1700000000000,
  setInTimeSystem: "custom",
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
  lastFiredAt: null,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

const mockSleepSession: SleepSession = {
  id: "sleep-1",
  source: "manual",
  startTimestampMs: 1700000000000,
  endTimestampMs: 1700028800000,
  stages: [],
  durationMs: 28800000,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

function createMockPlatformServices(
  backupOverrides?: Partial<PlatformServices["backup"]>,
): PlatformServices {
  return {
    type: "aosp",
    auth: {
      signIn: jest
        .fn()
        .mockResolvedValue({ email: "test@example.com", accessToken: "token" }),
      signOut: jest.fn().mockResolvedValue(undefined),
      getAccessToken: jest.fn().mockResolvedValue(null),
      isAvailable: jest.fn().mockResolvedValue(true),
    },
    calendar: {
      fetchEvents: jest.fn().mockResolvedValue([]),
      getCalendarList: jest.fn().mockResolvedValue([]),
      isAvailable: jest.fn().mockResolvedValue(true),
    },
    backup: {
      backup: jest.fn().mockResolvedValue(undefined),
      restore: jest.fn().mockResolvedValue(null),
      getLastBackupTime: jest.fn().mockResolvedValue(null),
      isAvailable: jest.fn().mockResolvedValue(true),
      ...backupOverrides,
    },
    sleep: {
      fetchSleepSessions: jest.fn().mockResolvedValue([]),
      isAvailable: jest.fn().mockResolvedValue(true),
    },
  };
}

function renderWithProviders(store = createStore()) {
  store.set(settingsAtom, DEFAULT_SETTINGS);
  store.set(alarmsAtom, []);
  store.set(sleepSessionsAtom, []);
  return {
    store,
    ...render(
      <JotaiProvider store={store}>
        <PaperProvider>
          <SettingsScreen />
        </PaperProvider>
      </JotaiProvider>,
    ),
  };
}

beforeEach(() => {
  mockServices = createMockPlatformServices();
});

describe("SettingsScreen", () => {
  it("should render without crashing", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("settings-screen")).toBeTruthy();
  });

  it("should display cycle config inputs", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("cycle-hours-input")).toBeTruthy();
    expect(getByTestId("cycle-minutes-input")).toBeTruthy();
  });

  it("should display use current time button", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("use-current-time-button")).toBeTruthy();
  });

  it("should display timezone item", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("timezone-item")).toBeTruthy();
  });

  it("should display backup buttons", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("backup-now-button")).toBeTruthy();
    expect(getByTestId("restore-button")).toBeTruthy();
  });

  it("should display alarm defaults section", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("vibration-item")).toBeTruthy();
    expect(getByTestId("gradual-volume-item")).toBeTruthy();
  });

  it("should display default time display setting in general section", async () => {
    const { getByText } = await renderWithProviders();
    expect(getByText("settings.primaryDisplay")).toBeTruthy();
    expect(getByText("settings.custom")).toBeTruthy();
    expect(getByText("settings.standard24h")).toBeTruthy();
  });

  it("should display primary display description text", async () => {
    const { getByText } = await renderWithProviders();
    expect(getByText("settings.primaryDisplayDescription")).toBeTruthy();
  });

  describe("backup", () => {
    it("should call backup service with serialized data on backup button press", async () => {
      const store = createStore();
      store.set(settingsAtom, DEFAULT_SETTINGS);
      store.set(alarmsAtom, [mockAlarm]);
      store.set(sleepSessionsAtom, [mockSleepSession]);

      const { getByTestId } = await render(
        <JotaiProvider store={store}>
          <PaperProvider>
            <SettingsScreen />
          </PaperProvider>
        </JotaiProvider>,
      );

      await fireEvent.press(getByTestId("backup-now-button"));

      await waitFor(() => {
        expect(mockServices.backup.backup).toHaveBeenCalledTimes(1);
      });

      const calledWith = (mockServices.backup.backup as jest.Mock).mock
        .calls[0][0];
      const parsed = JSON.parse(calledWith);
      expect(parsed.version).toBe(1);
      expect(parsed.timestamp).toBeGreaterThan(0);
      expect(parsed.alarms).toHaveLength(1);
      expect(parsed.alarms[0].id).toBe("alarm-1");
      expect(parsed.sleepSessions).toHaveLength(1);
      expect(parsed.sleepSessions[0].id).toBe("sleep-1");
      expect(parsed.settings).toBeDefined();
    });

    it("should update lastBackupTimestamp on successful backup", async () => {
      const store = createStore();
      store.set(settingsAtom, {
        ...DEFAULT_SETTINGS,
        lastBackupTimestamp: null,
      });
      store.set(alarmsAtom, []);
      store.set(sleepSessionsAtom, []);

      const { getByTestId } = await render(
        <JotaiProvider store={store}>
          <PaperProvider>
            <SettingsScreen />
          </PaperProvider>
        </JotaiProvider>,
      );

      await fireEvent.press(getByTestId("backup-now-button"));

      await waitFor(() => {
        const updatedSettings = store.get(settingsAtom);
        expect(updatedSettings.lastBackupTimestamp).not.toBeNull();
        expect(updatedSettings.lastBackupTimestamp).toBeGreaterThan(0);
      });
    });

    it("should show success snackbar on successful backup", async () => {
      const { getByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("backup-now-button"));

      await waitFor(() => {
        expect(getByTestId("settings-snackbar")).toHaveTextContent(
          "settings.backupSuccess",
        );
      });
    });

    it("should show failure snackbar when backup throws", async () => {
      mockServices = createMockPlatformServices({
        backup: jest.fn().mockRejectedValue(new Error("disk full")),
      });

      const { getByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("backup-now-button"));

      await waitFor(() => {
        expect(getByTestId("settings-snackbar")).toHaveTextContent(
          "settings.backupFailed",
        );
      });
    });
  });

  describe("restore", () => {
    it("should restore settings, alarms, and sleepSessions from backup", async () => {
      const backupData = JSON.stringify({
        version: 1,
        timestamp: 1700000000000,
        settings: { ...DEFAULT_SETTINGS, language: "ja" },
        alarms: [mockAlarm],
        sleepSessions: [mockSleepSession],
      });
      mockServices = createMockPlatformServices({
        restore: jest.fn().mockResolvedValue(backupData),
      });

      const store = createStore();
      store.set(settingsAtom, DEFAULT_SETTINGS);
      store.set(alarmsAtom, []);
      store.set(sleepSessionsAtom, []);

      const { getByTestId } = await render(
        <JotaiProvider store={store}>
          <PaperProvider>
            <SettingsScreen />
          </PaperProvider>
        </JotaiProvider>,
      );

      await fireEvent.press(getByTestId("restore-button"));

      await waitFor(() => {
        expect(store.get(settingsAtom).language).toBe("ja");
        expect(store.get(alarmsAtom)).toHaveLength(1);
        expect(store.get(alarmsAtom)[0].id).toBe("alarm-1");
        expect(store.get(sleepSessionsAtom)).toHaveLength(1);
        expect(store.get(sleepSessionsAtom)[0].id).toBe("sleep-1");
      });
    });

    it("should show success snackbar on successful restore", async () => {
      const backupData = JSON.stringify({
        version: 1,
        timestamp: 1700000000000,
        settings: DEFAULT_SETTINGS,
        alarms: [],
        sleepSessions: [],
      });
      mockServices = createMockPlatformServices({
        restore: jest.fn().mockResolvedValue(backupData),
      });

      const { getByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("restore-button"));

      await waitFor(() => {
        expect(getByTestId("settings-snackbar")).toHaveTextContent(
          "settings.restoreSuccess",
        );
      });
    });

    it("should show noBackupFound snackbar when restore returns null", async () => {
      mockServices = createMockPlatformServices({
        restore: jest.fn().mockResolvedValue(null),
      });

      const { getByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("restore-button"));

      await waitFor(() => {
        expect(getByTestId("settings-snackbar")).toHaveTextContent(
          "settings.noBackupFound",
        );
      });
    });

    it("should show version error snackbar for incompatible backup version", async () => {
      const backupData = JSON.stringify({
        version: 99,
        timestamp: 1700000000000,
        settings: DEFAULT_SETTINGS,
        alarms: [],
        sleepSessions: [],
      });
      mockServices = createMockPlatformServices({
        restore: jest.fn().mockResolvedValue(backupData),
      });

      const { getByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("restore-button"));

      await waitFor(() => {
        expect(getByTestId("settings-snackbar")).toHaveTextContent(
          "settings.backupVersionError",
        );
      });
    });

    it("should show failure snackbar when restore throws", async () => {
      mockServices = createMockPlatformServices({
        restore: jest.fn().mockRejectedValue(new Error("network error")),
      });

      const { getByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("restore-button"));

      await waitFor(() => {
        expect(getByTestId("settings-snackbar")).toHaveTextContent(
          "settings.restoreFailed",
        );
      });
    });

    it("should show failure snackbar when backup data is invalid JSON", async () => {
      mockServices = createMockPlatformServices({
        restore: jest.fn().mockResolvedValue("not valid json{{{"),
      });

      const { getByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("restore-button"));

      await waitFor(() => {
        expect(getByTestId("settings-snackbar")).toHaveTextContent(
          "settings.restoreFailed",
        );
      });
    });

    it("should handle partial backup data gracefully", async () => {
      const backupData = JSON.stringify({
        version: 1,
        timestamp: 1700000000000,
        settings: { ...DEFAULT_SETTINGS, language: "ja" },
      });
      mockServices = createMockPlatformServices({
        restore: jest.fn().mockResolvedValue(backupData),
      });

      const store = createStore();
      store.set(settingsAtom, DEFAULT_SETTINGS);
      store.set(alarmsAtom, [mockAlarm]);
      store.set(sleepSessionsAtom, [mockSleepSession]);

      const { getByTestId } = await render(
        <JotaiProvider store={store}>
          <PaperProvider>
            <SettingsScreen />
          </PaperProvider>
        </JotaiProvider>,
      );

      await fireEvent.press(getByTestId("restore-button"));

      await waitFor(() => {
        // Settings should be updated from backup
        expect(store.get(settingsAtom).language).toBe("ja");
        // Restore should succeed even without alarms/sleepSessions in backup
        expect(getByTestId("settings-snackbar")).toHaveTextContent(
          "settings.restoreSuccess",
        );
      });
    });
  });
});

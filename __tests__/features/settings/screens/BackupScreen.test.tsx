import { act, fireEvent, render } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { alarmsAtom } from "../../../../src/atoms/alarmAtoms";
import {
  resolvedSettingsAtom,
  settingsAtom,
} from "../../../../src/atoms/settingsAtoms";
import { sleepSessionsAtom } from "../../../../src/atoms/sleepAtoms";
import { createPlatformServices } from "../../../../src/core/platform/factory";
import type { PlatformServices } from "../../../../src/core/platform/types";
import { game2048StoreAtom } from "../../../../src/features/game2048/atoms/game2048Atoms";
import { createDefaultStore } from "../../../../src/features/game2048/logic/gameEngine";
import { BackupScreen } from "../../../../src/features/settings/screens/BackupScreen";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
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
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
    i18n: { language: "en" },
  }),
}));

jest.mock("../../../../src/features/widget/services/widgetUpdater", () => ({
  requestClockWidgetUpdate: jest.fn(),
}));

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

jest.mock("../../../../src/core/platform/factory");

const mockCreatePlatformServices =
  createPlatformServices as jest.MockedFunction<typeof createPlatformServices>;

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

let mockServices: PlatformServices;

async function renderWithProviders() {
  mockServices = createMockServices();
  mockCreatePlatformServices.mockReturnValue(mockServices);

  const store = createStore();
  store.set(settingsAtom, DEFAULT_SETTINGS);
  store.set(alarmsAtom, []);
  store.set(sleepSessionsAtom, []);
  store.set(game2048StoreAtom, createDefaultStore());

  const utils = await render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <BackupScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  await act(async () => {});
  return { ...utils, store };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("BackupScreen", () => {
  it("should render without crashing", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("backup-screen")).toBeTruthy();
  });

  it("should display backup and restore buttons", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("backup-now-button")).toBeTruthy();
    expect(getByTestId("restore-button")).toBeTruthy();
  });

  it("should display last backup info", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("last-backup-item")).toBeTruthy();
  });

  it("should call platformServices.backup.backup on backup button press", async () => {
    const { getByTestId } = await renderWithProviders();

    await act(async () => {
      fireEvent.press(getByTestId("backup-now-button"));
    });

    expect(mockServices.backup.backup).toHaveBeenCalledTimes(1);
    expect(mockServices.backup.backup).toHaveBeenCalledWith(expect.any(String));
  });

  it("should call platformServices.backup.restore on restore button press", async () => {
    const { getByTestId } = await renderWithProviders();

    await act(async () => {
      fireEvent.press(getByTestId("restore-button"));
    });

    expect(mockServices.backup.restore).toHaveBeenCalledTimes(1);
  });

  it("should update lastBackupTimestamp after successful backup", async () => {
    const { getByTestId, store } = await renderWithProviders();

    await act(async () => {
      fireEvent.press(getByTestId("backup-now-button"));
    });

    const settings = store.get(resolvedSettingsAtom);
    expect(settings.lastBackupTimestamp).not.toBeNull();
    expect(typeof settings.lastBackupTimestamp).toBe("number");
  });

  it("should serialize alarms, settings, sleepSessions, and game2048 in backup data", async () => {
    const { getByTestId } = await renderWithProviders();

    await act(async () => {
      fireEvent.press(getByTestId("backup-now-button"));
    });

    const call = (mockServices.backup.backup as jest.Mock).mock.calls[0];
    const data = JSON.parse(call[0]);
    expect(data.version).toBe(1);
    expect(data.timestamp).toEqual(expect.any(Number));
    expect(data.settings).toBeDefined();
    expect(data.alarms).toEqual([]);
    expect(data.sleepSessions).toEqual([]);
    expect(data.game2048).toBeDefined();
  });

  it("should restore settings, alarms, sleepSessions, and game2048 from backup", async () => {
    const restoredSettings = {
      ...DEFAULT_SETTINGS,
      language: "ja",
      lastBackupTimestamp: 1700000000000,
    };
    const restoredGame2048 = createDefaultStore();
    const validBackup = JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      settings: restoredSettings,
      alarms: [{ id: "restored-alarm" }],
      sleepSessions: [{ id: "restored-session" }],
      game2048: restoredGame2048,
    });

    const { getByTestId, store } = await renderWithProviders();

    (mockServices.backup.restore as jest.Mock).mockResolvedValue(validBackup);

    await act(async () => {
      fireEvent.press(getByTestId("restore-button"));
    });

    const settings = store.get(resolvedSettingsAtom);
    expect(settings.language).toBe("ja");

    const alarms = store.get(alarmsAtom);
    expect(alarms).toHaveLength(1);

    const sleep = store.get(sleepSessionsAtom);
    expect(sleep).toHaveLength(1);
  });

  it("should not update lastBackupTimestamp when backup fails", async () => {
    const { getByTestId, store } = await renderWithProviders();

    (mockServices.backup.backup as jest.Mock).mockRejectedValue(
      new Error("Network error"),
    );

    await act(async () => {
      fireEvent.press(getByTestId("backup-now-button"));
    });

    const settings = store.get(resolvedSettingsAtom);
    expect(settings.lastBackupTimestamp).toBeNull();
  });

  it("should not update settings when restore returns null", async () => {
    const { getByTestId, store } = await renderWithProviders();

    // restore returns null by default from createMockServices

    await act(async () => {
      fireEvent.press(getByTestId("restore-button"));
    });

    // Settings should remain unchanged
    const settings = store.get(resolvedSettingsAtom);
    expect(settings.lastBackupTimestamp).toBeNull();
    expect(settings.language).toBe("auto");
  });
});

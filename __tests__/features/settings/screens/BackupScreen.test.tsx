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
import {
  type AppSettings,
  DEFAULT_SETTINGS,
} from "../../../../src/models/Settings";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../../../../src/core/storage/asyncStorageAdapter", () => ({
  createAsyncStorage: () => {
    const store = new Map<string, unknown>();
    return {
      getItem: (key: string, initialValue: unknown) =>
        store.has(key) ? store.get(key) : initialValue,
      setItem: (key: string, value: unknown) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
  },
}));

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

jest.mock("../../../../src/features/alarm/services/alarmScheduler", () => ({
  cancelAlarm: jest.fn().mockResolvedValue(undefined),
  scheduleAlarm: jest.fn().mockResolvedValue("restored-trigger"),
}));

jest.mock("../../../../src/features/alarm/services/alarmRescheduler", () => ({
  getAlarmToSchedule: jest.fn((alarm) => alarm),
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

async function renderWithProviders(
  settingsOverride: Partial<AppSettings> = {},
  remoteBackupTimestamp: number | null = null,
  type: PlatformServices["type"] = "aosp",
  backupAvailability: boolean | Error = true,
  authAvailability: boolean | Error = true,
) {
  mockServices = createMockServices();
  mockServices.type = type;
  if (authAvailability instanceof Error) {
    (mockServices.auth.isAvailable as jest.Mock).mockRejectedValue(
      authAvailability,
    );
  } else {
    (mockServices.auth.isAvailable as jest.Mock).mockResolvedValue(
      authAvailability,
    );
  }
  if (backupAvailability instanceof Error) {
    (mockServices.backup.isAvailable as jest.Mock).mockRejectedValue(
      backupAvailability,
    );
  } else {
    (mockServices.backup.isAvailable as jest.Mock).mockResolvedValue(
      backupAvailability,
    );
  }
  (mockServices.backup.getLastBackupTime as jest.Mock).mockResolvedValue(
    remoteBackupTimestamp,
  );
  mockCreatePlatformServices.mockReturnValue(mockServices);

  const store = createStore();
  store.set(settingsAtom, { ...DEFAULT_SETTINGS, ...settingsOverride });
  store.set(alarmsAtom, []);
  store.set(sleepSessionsAtom, []);
  store.set(game2048StoreAtom, createDefaultStore());

  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <BackupScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
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
    expect(mockServices.backup.getLastBackupTime).toHaveBeenCalled();
  });

  it("labels AOSP backups as on-device snapshots", async () => {
    const { getByText } = await renderWithProviders();

    expect(getByText("settings.localSnapshot")).toBeTruthy();
    expect(getByText("settings.localSnapshotDescription")).toBeTruthy();
  });

  it("requires sign-in before enabling cloud backup actions", async () => {
    const { getByTestId, getByText } = await renderWithProviders(
      {},
      null,
      "gms",
      false,
    );

    await act(async () => {});

    expect(getByText("settings.backupRequiresSignIn")).toBeTruthy();
    expect(getByTestId("backup-sign-in-button")).toBeTruthy();
    expect(getByTestId("backup-now-button").props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(getByTestId("restore-button").props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it("enables cloud backup after settings sign-in succeeds", async () => {
    const { getByTestId, getByText } = await renderWithProviders(
      {},
      null,
      "gms",
      false,
    );
    (mockServices.auth.signIn as jest.Mock).mockResolvedValue({
      email: "test@example.com",
      accessToken: "token",
    });
    (mockServices.backup.isAvailable as jest.Mock).mockResolvedValue(true);

    await act(async () => {
      fireEvent.press(getByTestId("backup-sign-in-button"));
    });

    expect(mockServices.auth.signIn).toHaveBeenCalledTimes(1);
    expect(getByText("settings.backupReady")).toBeTruthy();
    expect(getByTestId("backup-now-button").props.accessibilityState).toEqual({
      disabled: false,
    });
  });

  it("keeps sign-in available when the backup status check fails", async () => {
    const { getByTestId } = await renderWithProviders(
      {},
      null,
      "gms",
      new Error("token refresh failed"),
    );

    expect(getByTestId("backup-sign-in-button")).toBeTruthy();
  });

  it("does not query cloud backup when platform auth is unavailable", async () => {
    const { getByText, queryByTestId } = await renderWithProviders(
      {},
      null,
      "hms",
      true,
      false,
    );

    expect(getByText("settings.backupUnavailable")).toBeTruthy();
    expect(queryByTestId("backup-sign-in-button")).toBeNull();
    expect(mockServices.backup.isAvailable).not.toHaveBeenCalled();
  });

  it("allows another sign-in attempt after sign-in fails", async () => {
    const { getByTestId, getByText } = await renderWithProviders(
      {},
      null,
      "gms",
      false,
    );
    (mockServices.auth.signIn as jest.Mock).mockRejectedValue(
      new Error("sign-in failed"),
    );

    await act(async () => {
      fireEvent.press(getByTestId("backup-sign-in-button"));
    });

    expect(getByText("settings.backupSignInFailed")).toBeTruthy();
    expect(getByTestId("backup-sign-in-button")).toBeTruthy();
    expect(
      getByTestId("backup-sign-in-button").props.accessibilityState?.disabled,
    ).toBe(false);
  });

  it("displays the newer remote backup timestamp", async () => {
    const remote = new Date("2026-02-20T10:00:00Z").getTime();
    const local = new Date("2026-02-19T10:00:00Z").getTime();
    const { getByText } = await renderWithProviders(
      { lastBackupTimestamp: local },
      remote,
    );

    expect(getByText("2026-02-20 19:00")).toBeTruthy();
  });

  it("should call platformServices.backup.backup on backup button press", async () => {
    const { getByTestId } = await renderWithProviders();

    await act(async () => {
      fireEvent.press(getByTestId("backup-now-button"));
    });

    expect(mockServices.backup.backup).toHaveBeenCalledTimes(1);
    expect(mockServices.backup.backup).toHaveBeenCalledWith(expect.any(String));
  });

  it("ignores a second backup tap while the first backup is pending", async () => {
    const { getByTestId } = await renderWithProviders();
    let resolveBackup: () => void;
    (mockServices.backup.backup as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveBackup = resolve;
        }),
    );

    act(() => {
      fireEvent.press(getByTestId("backup-now-button"));
      fireEvent.press(getByTestId("backup-now-button"));
      fireEvent.press(getByTestId("restore-button"));
    });

    expect(mockServices.backup.backup).toHaveBeenCalledTimes(1);
    expect(mockServices.backup.restore).not.toHaveBeenCalled();
    expect(getByTestId("backup-now-button").props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(getByTestId("restore-button").props.accessibilityState).toEqual({
      disabled: true,
    });
    await act(async () => {
      resolveBackup!();
    });
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
      alarms: [],
      sleepSessions: [],
      game2048: restoredGame2048,
    });

    const { getByTestId, store } = await renderWithProviders();

    (mockServices.backup.restore as jest.Mock).mockResolvedValue(validBackup);

    await act(async () => {
      fireEvent.press(getByTestId("restore-button"));
    });

    const settings = store.get(resolvedSettingsAtom);
    expect(settings.language).toBe("ja");

    expect(store.get(alarmsAtom)).toEqual([]);
    expect(store.get(sleepSessionsAtom)).toEqual([]);
  });

  it("rejects malformed restore data before writing atoms", async () => {
    const { getByTestId, store } = await renderWithProviders();
    (mockServices.backup.restore as jest.Mock).mockResolvedValue(
      JSON.stringify({ version: 1, timestamp: Date.now(), settings: {} }),
    );

    await act(async () => {
      fireEvent.press(getByTestId("restore-button"));
    });

    expect(store.get(resolvedSettingsAtom)).toEqual(DEFAULT_SETTINGS);
    expect(store.get(alarmsAtom)).toEqual([]);
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

    await act(async () => {
      fireEvent.press(getByTestId("restore-button"));
    });

    const settings = store.get(resolvedSettingsAtom);
    expect(settings.lastBackupTimestamp).toBeNull();
    expect(settings.language).toBe("auto");
  });
});

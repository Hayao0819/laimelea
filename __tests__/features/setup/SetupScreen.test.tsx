import NetInfo from "@react-native-community/netinfo";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { StyleSheet } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import { createPlatformServices } from "../../../src/core/platform/factory";
import type { PlatformServices } from "../../../src/core/platform/types";
import { SetupScreen } from "../../../src/features/setup/screens/SetupScreen";
import type { AppSettings } from "../../../src/models/Settings";

const mockAddEventListener = NetInfo.addEventListener as jest.Mock;

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
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

jest.mock("../../../src/core/platform/factory");

const mockCreatePlatformServices =
  createPlatformServices as jest.MockedFunction<typeof createPlatformServices>;

const mockSignIn = jest.fn();
const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 12, right: 8, bottom: 24, left: 4 },
};

function createMockServices(): PlatformServices {
  return {
    type: "gms",
    auth: {
      isAvailable: jest.fn().mockResolvedValue(true),
      signIn: mockSignIn,
      signOut: jest.fn().mockResolvedValue(undefined),
      getAccessToken: jest.fn().mockResolvedValue("token"),
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

async function renderWithProviders(
  store = createStore(),
  services = createMockServices(),
) {
  mockCreatePlatformServices.mockReturnValue(services);

  const utils = render(
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <JotaiProvider store={store}>
        <PaperProvider>
          <SetupScreen />
        </PaperProvider>
      </JotaiProvider>
    </SafeAreaProvider>,
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

describe("SetupScreen", () => {
  it("should display welcome text", async () => {
    const { getByText } = await renderWithProviders();
    expect(getByText("setup.welcome")).toBeTruthy();
    expect(getByText("setup.description")).toBeTruthy();
  });

  it("adds safe-area insets to scroll content", async () => {
    const { getByTestId } = await renderWithProviders();
    const contentStyle = StyleSheet.flatten(
      getByTestId("setup-scroll").props.contentContainerStyle,
    );

    expect(contentStyle.paddingTop).toBe(76);
    expect(contentStyle.paddingRight).toBe(24);
    expect(contentStyle.paddingBottom).toBe(40);
    expect(contentStyle.paddingLeft).toBe(20);
  });

  it("should have done button disabled initially", async () => {
    const { getByTestId } = await renderWithProviders();
    const doneButton = getByTestId("done-button");
    expect(doneButton.props.accessibilityState?.disabled).toBe(true);
  });

  it("should enable done button after setting base time", async () => {
    const { getByText, getByTestId } = await renderWithProviders();

    await act(async () => {
      fireEvent.press(getByText("setup.useNow"));
    });

    await waitFor(() => {
      const doneButton = getByTestId("done-button");
      expect(doneButton.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  it("keeps completion disabled for non-finite cycle input", async () => {
    const { getByText, getByTestId } = await renderWithProviders();

    await act(async () => {
      fireEvent.changeText(getByTestId("cycle-hours"), "1e309");
      fireEvent.press(getByText("setup.useNow"));
    });

    expect(getByTestId("done-button").props.accessibilityState?.disabled).toBe(
      true,
    );
  });

  it("should set setupComplete to true on done", async () => {
    const store = createStore();
    const { getByText, getByTestId } = await renderWithProviders(store);

    await act(async () => {
      fireEvent.press(getByText("setup.useNow"));
    });

    await act(async () => {
      fireEvent.press(getByTestId("done-button"));
    });

    const settings = store.get(settingsAtom) as AppSettings;
    expect(settings.setupComplete).toBe(true);
    expect(settings.cycleConfig.cycleLengthMinutes).toBe(1560);
    expect(settings.cycleConfig.baseTimeMs).toBeGreaterThan(0);
  });

  it("should show preview after setting base time", async () => {
    const { getByText } = await renderWithProviders();

    await act(async () => {
      fireEvent.press(getByText("setup.useNow"));
    });

    await waitFor(() => {
      expect(getByText("setup.preview")).toBeTruthy();
    });
  });

  describe("Google sign-in", () => {
    it("should display Google sign-in button", async () => {
      const { getByTestId } = await renderWithProviders();
      expect(getByTestId("google-sign-in-button")).toBeTruthy();
    });

    it("should call auth.signIn and display signed-in account", async () => {
      mockSignIn.mockResolvedValue({
        email: "user@gmail.com",
        accessToken: "token",
      });

      const { getByTestId } = await renderWithProviders();

      await act(async () => {
        fireEvent.press(getByTestId("google-sign-in-button"));
      });

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledTimes(1);
        expect(getByTestId("signed-in-account-user@gmail.com")).toBeTruthy();
      });
    });

    it("should allow Done without signing in", async () => {
      const { getByText, getByTestId } = await renderWithProviders();

      await act(async () => {
        fireEvent.press(getByText("setup.useNow"));
      });

      await waitFor(() => {
        const doneButton = getByTestId("done-button");
        expect(doneButton.props.accessibilityState?.disabled).toBeFalsy();
      });
    });

    it("should not save accounts to settings on Done (single-account auth is separate)", async () => {
      mockSignIn.mockResolvedValue({
        email: "user@gmail.com",
        accessToken: "token",
      });

      const store = createStore();
      const { getByText, getByTestId } = await renderWithProviders(store);

      await act(async () => {
        fireEvent.press(getByText("setup.useNow"));
      });

      await act(async () => {
        fireEvent.press(getByTestId("google-sign-in-button"));
      });

      await waitFor(() => {
        expect(getByTestId("signed-in-account-user@gmail.com")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId("done-button"));
      });

      const settings = store.get(settingsAtom) as AppSettings;
      expect(settings.setupComplete).toBe(true);
    });

    it("should handle sign-in cancellation gracefully", async () => {
      mockSignIn.mockRejectedValue(new Error("User cancelled"));

      const { getByTestId, queryByTestId } = await renderWithProviders();

      await act(async () => {
        fireEvent.press(getByTestId("google-sign-in-button"));
      });

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledTimes(1);
      });

      expect(queryByTestId(/^signed-in-account-/)).toBeNull();
      expect(getByTestId("google-sign-in-button")).toBeTruthy();
    });

    it("should hide sign-in button and show account after successful sign-in", async () => {
      mockSignIn.mockResolvedValue({
        email: "user@gmail.com",
        accessToken: "token",
      });

      const { getByTestId, queryByTestId } = await renderWithProviders();

      await act(async () => {
        fireEvent.press(getByTestId("google-sign-in-button"));
      });

      await waitFor(() => {
        expect(getByTestId("signed-in-account-user@gmail.com")).toBeTruthy();
        expect(queryByTestId("google-sign-in-button")).toBeNull();
      });
    });

    it("should hide Google account section when offline", async () => {
      mockAddEventListener.mockImplementation((callback) => {
        callback({ isConnected: false, isInternetReachable: false });
        return () => {};
      });

      const { queryByTestId, queryByText } = await renderWithProviders();

      expect(queryByTestId("google-sign-in-button")).toBeNull();
      expect(queryByText("setup.backupAccount")).toBeNull();
    });

    it("should show Google account section when online", async () => {
      mockAddEventListener.mockImplementation((callback) => {
        callback({ isConnected: true, isInternetReachable: true });
        return () => {};
      });

      const { getByTestId, getByText } = await renderWithProviders();

      expect(getByTestId("google-sign-in-button")).toBeTruthy();
      expect(getByText("setup.backupAccount")).toBeTruthy();
    });

    it("does not offer cloud sign-in on AOSP", async () => {
      const services = createMockServices();
      services.type = "aosp";

      const { queryByTestId } = await renderWithProviders(
        createStore(),
        services,
      );

      expect(queryByTestId("google-sign-in-button")).toBeNull();
      expect(services.auth.isAvailable).not.toHaveBeenCalled();
    });

    it("does not offer sign-in when platform auth is unavailable", async () => {
      const services = createMockServices();
      (services.auth.isAvailable as jest.Mock).mockResolvedValue(false);

      const { queryByTestId } = await renderWithProviders(
        createStore(),
        services,
      );

      expect(queryByTestId("google-sign-in-button")).toBeNull();
    });

    it("does not offer sign-in when the availability check fails", async () => {
      const services = createMockServices();
      (services.auth.isAvailable as jest.Mock).mockRejectedValue(
        new Error("service check failed"),
      );

      const { queryByTestId } = await renderWithProviders(
        createStore(),
        services,
      );

      expect(queryByTestId("google-sign-in-button")).toBeNull();
    });
  });
});

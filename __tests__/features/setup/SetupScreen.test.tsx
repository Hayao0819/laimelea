import React from "react";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";

import { SetupScreen } from "../../../src/features/setup/screens/SetupScreen";
import { settingsAtom } from "../../../src/atoms/settingsAtoms";
import type { AppSettings } from "../../../src/models/Settings";
import type { Account } from "../../../src/core/account/types";

const mockAddAccount = jest.fn();

jest.mock("../../../src/core/account/accountManager", () => ({
  createAccountManager: () => ({
    addAccount: (...args: unknown[]) => mockAddAccount(...args),
    removeAccount: jest.fn(),
    getAccounts: jest.fn(),
    getAccessToken: jest.fn(),
    getAllAccessTokens: jest.fn(),
  }),
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
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

function createMockAccount(email: string): Account {
  return {
    email,
    displayName: email.split("@")[0],
    photoUrl: null,
    provider: "app-auth",
    addedAt: Date.now(),
  };
}

function renderWithProviders(store = createStore()) {
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <SetupScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
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
    expect(settings.cycleConfig.cycleLengthMinutes).toBe(1560); // 26h default
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

    it("should call addAccount on sign-in button tap and display account", async () => {
      const mockAccount = createMockAccount("user@gmail.com");
      mockAddAccount.mockResolvedValue(mockAccount);

      const { getByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("google-sign-in-button"));

      await waitFor(() => {
        expect(mockAddAccount).toHaveBeenCalledTimes(1);
        expect(getByTestId("added-account-user@gmail.com")).toBeTruthy();
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

    it("should save accounts to settings on Done", async () => {
      const mockAccount = createMockAccount("user@gmail.com");
      mockAddAccount.mockResolvedValue(mockAccount);

      const store = createStore();
      const { getByText, getByTestId } = await renderWithProviders(store);

      await fireEvent.press(getByText("setup.useNow"));

      await fireEvent.press(getByTestId("google-sign-in-button"));

      await waitFor(() => {
        expect(getByTestId("added-account-user@gmail.com")).toBeTruthy();
      });

      await fireEvent.press(getByTestId("done-button"));

      const settings = store.get(settingsAtom) as AppSettings;
      expect(settings.setupComplete).toBe(true);
      expect(settings.accounts).toHaveLength(1);
      expect(settings.accounts[0].email).toBe("user@gmail.com");
    });

    it("should handle sign-in cancellation gracefully", async () => {
      mockAddAccount.mockRejectedValue(new Error("User cancelled"));

      const { getByTestId, queryByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("google-sign-in-button"));

      await waitFor(() => {
        expect(mockAddAccount).toHaveBeenCalledTimes(1);
      });

      expect(queryByTestId(/^added-account-/)).toBeNull();
    });

    it("should support adding multiple accounts", async () => {
      const account1 = createMockAccount("user1@gmail.com");
      const account2 = createMockAccount("user2@gmail.com");
      mockAddAccount
        .mockResolvedValueOnce(account1)
        .mockResolvedValueOnce(account2);

      const { getByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("google-sign-in-button"));

      await waitFor(() => {
        expect(getByTestId("added-account-user1@gmail.com")).toBeTruthy();
      });

      await fireEvent.press(getByTestId("google-sign-in-button"));

      await waitFor(() => {
        expect(getByTestId("added-account-user1@gmail.com")).toBeTruthy();
        expect(getByTestId("added-account-user2@gmail.com")).toBeTruthy();
      });
    });

    it("should update existing account when re-added with same email", async () => {
      const account1 = createMockAccount("user@gmail.com");
      const account2 = {
        ...createMockAccount("user@gmail.com"),
        displayName: "Updated",
      };
      mockAddAccount
        .mockResolvedValueOnce(account1)
        .mockResolvedValueOnce(account2);

      const { getByTestId, getAllByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("google-sign-in-button"));

      await waitFor(() => {
        expect(getByTestId("added-account-user@gmail.com")).toBeTruthy();
      });

      await fireEvent.press(getByTestId("google-sign-in-button"));

      await waitFor(() => {
        const items = getAllByTestId("added-account-user@gmail.com");
        expect(items).toHaveLength(1);
      });
    });
  });
});

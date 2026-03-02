import React from "react";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { AboutScreen } from "../../../../src/features/settings/screens/AboutScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
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
      _reset: () => {
        store = {};
      },
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

async function renderWithProviders() {
  const store = createStore();
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <AboutScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  await act(async () => {});
  return { store, ...utils };
}

let openURLSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (AsyncStorage as unknown as { _reset: () => void })._reset();
  openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  openURLSpy.mockRestore();
});

describe("AboutScreen", () => {
  it("should render without crashing", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("about-screen")).toBeTruthy();
  });

  it("should display app name Laimelea", async () => {
    const { getByText } = await renderWithProviders();
    expect(getByText("Laimelea")).toBeTruthy();
  });

  it("should display version", async () => {
    const { getByTestId } = await renderWithProviders();
    const versionItem = getByTestId("version-item");
    expect(versionItem).toBeTruthy();
  });

  it("should display developer info", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("developer-item")).toBeTruthy();
  });

  it("should navigate to Game2048 after 7 taps on version", async () => {
    const { getByTestId } = await renderWithProviders();
    const versionItem = getByTestId("version-item");

    for (let i = 0; i < 7; i++) {
      await act(async () => {
        fireEvent.press(versionItem);
      });
    }

    expect(mockNavigate).toHaveBeenCalledWith("Game2048");
  });

  it("should show hint snackbar at 5th tap", async () => {
    const { getByTestId, getByText } = await renderWithProviders();
    const versionItem = getByTestId("version-item");

    for (let i = 0; i < 5; i++) {
      await act(async () => {
        fireEvent.press(versionItem);
      });
    }

    expect(getByText('settings.tapMore:{"count":2}')).toBeTruthy();
  });

  it("should not show game item when not unlocked", async () => {
    const { queryByTestId } = await renderWithProviders();

    await act(async () => {});

    expect(queryByTestId("game-2048-item")).toBeNull();
  });

  it("should show game item when unlocked via AsyncStorage", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      String(Date.now()),
    );

    const { getByTestId } = await renderWithProviders();

    await waitFor(() => {
      expect(getByTestId("game-2048-item")).toBeTruthy();
    });
  });

  it("should open GitHub URL on developer link press", async () => {
    const { getByTestId } = await renderWithProviders();
    const githubItem = getByTestId("github-item");

    await act(async () => {
      fireEvent.press(githubItem);
    });

    expect(openURLSpy).toHaveBeenCalledWith("https://github.com/Hayao0819");
  });

  it("should open repository URL on source code press", async () => {
    const { getByTestId } = await renderWithProviders();
    const repoItem = getByTestId("repo-item");

    await act(async () => {
      fireEvent.press(repoItem);
    });

    expect(openURLSpy).toHaveBeenCalledWith(
      "https://github.com/Hayao0819/laimelea",
    );
  });
});

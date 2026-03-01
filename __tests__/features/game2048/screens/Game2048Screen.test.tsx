import React from "react";
import { render } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { Game2048Screen } from "../../../../src/features/game2048/screens/Game2048Screen";
import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";
import { game2048StoreAtom } from "../../../../src/features/game2048/atoms/game2048Atoms";
import { createDefaultStore } from "../../../../src/features/game2048/logic/gameEngine";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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

function createInitializedStore() {
  const store = createStore();
  store.set(settingsAtom, DEFAULT_SETTINGS);
  store.set(game2048StoreAtom, createDefaultStore());
  return store;
}

function renderWithProviders(store = createInitializedStore()) {
  return {
    store,
    ...render(
      <JotaiProvider store={store}>
        <PaperProvider>
          <Game2048Screen />
        </PaperProvider>
      </JotaiProvider>,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Game2048Screen", () => {
  it("should render without crashing", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("game-2048-screen")).toBeTruthy();
  });

  it("should display the game board", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("game-board")).toBeTruthy();
  });

  it("should display the header with score", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("game-header")).toBeTruthy();
  });

  it("should display settings and tree navigation buttons", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("settings-button")).toBeTruthy();
    expect(getByTestId("tree-button")).toBeTruthy();
  });

  it("should display save/load button", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("open-saves-button")).toBeTruthy();
  });
});

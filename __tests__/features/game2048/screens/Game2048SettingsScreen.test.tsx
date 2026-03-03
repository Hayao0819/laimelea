import { fireEvent, render } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import {
  game2048StoreAtom,
  resolvedStoreAtom,
} from "../../../../src/features/game2048/atoms/game2048Atoms";
import {
  createDefaultStore,
  createNewGame,
} from "../../../../src/features/game2048/logic/gameEngine";
import type { Game2048Store } from "../../../../src/features/game2048/logic/gameTypes";
import { Game2048SettingsScreen } from "../../../../src/features/game2048/screens/Game2048SettingsScreen";

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

function createTestStore(overrides: Partial<Game2048Store> = {}) {
  const jotaiStore = createStore();
  const defaultStore = createDefaultStore();
  jotaiStore.set(game2048StoreAtom, { ...defaultStore, ...overrides });
  return jotaiStore;
}

function renderWithProviders(jotaiStore = createTestStore()) {
  return {
    store: jotaiStore,
    ...render(
      <JotaiProvider store={jotaiStore}>
        <PaperProvider>
          <Game2048SettingsScreen />
        </PaperProvider>
      </JotaiProvider>,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Game2048SettingsScreen", () => {
  it("should render without crashing", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("game2048-settings-screen")).toBeTruthy();
  });

  it("should display Lucky Mode toggle initially off", async () => {
    const { getByTestId } = await renderWithProviders();
    const switchEl = getByTestId("lucky-mode-switch");
    expect(switchEl).toBeTruthy();
    expect(switchEl.props.value).toBe(false);
  });

  it("should toggle Lucky Mode on when pressed", async () => {
    const store = createTestStore();
    const { getByTestId } = await renderWithProviders(store);
    const switchEl = getByTestId("lucky-mode-switch");

    await fireEvent(switchEl, "valueChange", true);

    const updated = store.get(resolvedStoreAtom);
    expect(updated.settings.luckyMode).toBe(true);
  });

  it("should toggle Lucky Mode off after being on", async () => {
    const store = createTestStore({
      settings: { luckyMode: true },
    });
    const { getByTestId } = await renderWithProviders(store);
    const switchEl = getByTestId("lucky-mode-switch");
    expect(switchEl.props.value).toBe(true);

    await fireEvent(switchEl, "valueChange", false);

    const updated = store.get(resolvedStoreAtom);
    expect(updated.settings.luckyMode).toBe(false);
  });

  it("should display current board size as selected", async () => {
    const store = createTestStore({
      currentGame: createNewGame(5),
    });
    const { getByText } = await renderWithProviders(store);
    // All size labels should be rendered
    expect(getByText("3\u00d73")).toBeTruthy();
    expect(getByText("4\u00d74")).toBeTruthy();
    expect(getByText("5\u00d75")).toBeTruthy();
    expect(getByText("6\u00d76")).toBeTruthy();
  });

  it("should change board size when a different size is pressed", async () => {
    const store = createTestStore();
    // Default board size is 4
    const { getByText } = await renderWithProviders(store);

    await fireEvent.press(getByText("5\u00d75"));

    const updated = store.get(resolvedStoreAtom);
    expect(updated.currentGame.boardSize).toBe(5);
  });

  it("should save current game to perSizeGames when switching size", async () => {
    const store = createTestStore();
    const { getByText } = await renderWithProviders(store);

    await fireEvent.press(getByText("3\u00d73"));

    const updated = store.get(resolvedStoreAtom);
    // Previous size (4) should be saved in perSizeGames
    expect(updated.perSizeGames[4]).toBeDefined();
    expect(updated.perSizeGames[4]?.game.boardSize).toBe(4);
  });

  it("should disable board size buttons when game is in progress", async () => {
    const inProgressGame = createNewGame(4);
    inProgressGame.moveCount = 5;
    inProgressGame.score = 120;
    const store = createTestStore({
      currentGame: inProgressGame,
    });
    const { getByText } = await renderWithProviders(store);

    // Press a different size - the store should NOT change because buttons are disabled
    await fireEvent.press(getByText("5\u00d75"));

    const updated = store.get(resolvedStoreAtom);
    // Board size should remain unchanged
    expect(updated.currentGame.boardSize).toBe(4);
  });

  it("should show warning text when game is in progress", async () => {
    const inProgressGame = createNewGame(4);
    inProgressGame.moveCount = 3;
    const store = createTestStore({
      currentGame: inProgressGame,
    });
    const { getByTestId } = await renderWithProviders(store);
    expect(getByTestId("board-size-locked-text")).toBeTruthy();
  });

  it("should not show warning text when game has not started", async () => {
    const store = createTestStore();
    const { queryByTestId } = await renderWithProviders(store);
    expect(queryByTestId("board-size-locked-text")).toBeNull();
  });

  it("should allow board size change when moveCount is 0", async () => {
    const store = createTestStore();
    const { getByText, queryByTestId } = await renderWithProviders(store);

    // No warning text
    expect(queryByTestId("board-size-locked-text")).toBeNull();

    await fireEvent.press(getByText("6\u00d76"));

    const updated = store.get(resolvedStoreAtom);
    expect(updated.currentGame.boardSize).toBe(6);
  });

  it("should display Lucky Mode description text", async () => {
    const { getByText } = await renderWithProviders();
    expect(getByText("game2048.luckyModeDesc")).toBeTruthy();
  });

  it("should display section headers", async () => {
    const { getByText } = await renderWithProviders();
    expect(getByText("game2048.settings")).toBeTruthy();
    expect(getByText("game2048.boardSize")).toBeTruthy();
  });
});

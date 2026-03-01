import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PaperProvider } from "react-native-paper";
import { Game2048Screen } from "../../../../src/features/game2048/screens/Game2048Screen";
import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";
import {
  game2048StoreAtom,
  resolvedStoreAtom,
} from "../../../../src/features/game2048/atoms/game2048Atoms";
import {
  createDefaultStore,
  createNewGame,
  move,
} from "../../../../src/features/game2048/logic/gameEngine";
import type { Game2048Store } from "../../../../src/features/game2048/logic/gameTypes";

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

function createInitializedStore(overrides: Partial<Game2048Store> = {}) {
  const store = createStore();
  store.set(settingsAtom, DEFAULT_SETTINGS);
  const defaultStore = createDefaultStore();
  store.set(game2048StoreAtom, { ...defaultStore, ...overrides });
  return store;
}

function createGameOverStore() {
  return createInitializedStore({
    currentGame: {
      board: [
        [2, 4, 8, 16],
        [32, 64, 128, 256],
        [512, 1024, 2, 4],
        [8, 16, 32, 64],
      ],
      score: 1234,
      boardSize: 4,
      isGameOver: true,
      hasWon: false,
      wonAcknowledged: false,
      moveCount: 50,
    },
  });
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

  describe("auto-save on game over", () => {
    it("should auto-save snapshot when game transitions to game over", async () => {
      // Start with a game that is NOT game over
      const store = createInitializedStore();

      await renderWithProviders(store);

      // Verify no snapshots initially
      expect(store.get(resolvedStoreAtom).snapshots).toHaveLength(0);

      // Transition to game over by directly updating the store
      const currentStore = store.get(resolvedStoreAtom);
      store.set(game2048StoreAtom, {
        ...currentStore,
        currentGame: {
          ...currentStore.currentGame,
          isGameOver: true,
          score: 500,
        },
      });

      // Wait for the useEffect to fire
      await waitFor(() => {
        const snapshots = store.get(resolvedStoreAtom).snapshots;
        expect(snapshots).toHaveLength(1);
      });

      const snapshots = store.get(resolvedStoreAtom).snapshots;
      expect(snapshots[0].name).toMatch(/^Game Over/);
    });

    it("should not auto-save a second time when game over state persists", async () => {
      // Start with isGameOver: false, then transition to true
      const store = createInitializedStore();

      await renderWithProviders(store);

      // Transition to game over
      const currentStore = store.get(resolvedStoreAtom);
      store.set(game2048StoreAtom, {
        ...currentStore,
        currentGame: {
          ...currentStore.currentGame,
          isGameOver: true,
          score: 100,
        },
      });

      // Wait for auto-save
      await waitFor(() => {
        expect(store.get(resolvedStoreAtom).snapshots).toHaveLength(1);
      });

      // Trigger another re-render by updating an unrelated field
      const updatedStore = store.get(resolvedStoreAtom);
      store.set(game2048StoreAtom, {
        ...updatedStore,
        currentGame: {
          ...updatedStore.currentGame,
          isGameOver: true,
          score: 101,
        },
      });

      // Give time for any potential additional save
      await waitFor(() => {
        // Score changed, so the store was updated, but snapshots should still be 1
        expect(store.get(resolvedStoreAtom).currentGame.score).toBe(101);
      });

      // Should still only have 1 snapshot (no double-save)
      expect(store.get(resolvedStoreAtom).snapshots).toHaveLength(1);
    });
  });

  describe("navigation", () => {
    it("should navigate to Game2048Settings when settings button pressed", async () => {
      const { getByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("settings-button"));

      expect(mockNavigate).toHaveBeenCalledWith("Game2048Settings");
    });

    it("should navigate to Game2048Tree when tree button pressed", async () => {
      const { getByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("tree-button"));

      expect(mockNavigate).toHaveBeenCalledWith("Game2048Tree");
    });
  });

  describe("save/load dialog", () => {
    it("should open save list dialog when save/load button pressed", async () => {
      const { getByTestId } = await renderWithProviders();

      await fireEvent.press(getByTestId("open-saves-button"));

      expect(getByTestId("save-slot-dialog")).toBeTruthy();
    });

    it("should add a snapshot when save triggered from dialog", async () => {
      const store = createInitializedStore();
      const { getByTestId } = await renderWithProviders(store);

      // Open the save dialog
      await fireEvent.press(getByTestId("open-saves-button"));

      // Press the save button
      await fireEvent.press(getByTestId("save-current-button"));

      const snapshots = store.get(resolvedStoreAtom).snapshots;
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].name).toMatch(/^Save/);
    });
  });

  describe("new game", () => {
    it("should start new game when new game button pressed", async () => {
      // Start with a game that has some score and moves
      const gameWithProgress = createNewGame(4);
      const movedResult = move(gameWithProgress, "left");
      const store = createInitializedStore({
        currentGame: movedResult.state,
        history: [gameWithProgress],
      });

      const { getByTestId } = await renderWithProviders(store);

      await fireEvent.press(getByTestId("new-game-button"));

      const game = store.get(resolvedStoreAtom).currentGame;
      expect(game.score).toBe(0);
      expect(game.moveCount).toBe(0);
      expect(game.isGameOver).toBe(false);
      expect(game.boardSize).toBe(4);
    });
  });

  describe("game overlay interactions", () => {
    it("should show game overlay when game over", async () => {
      const store = createGameOverStore();
      const { getByTestId } = await renderWithProviders(store);

      expect(getByTestId("game-overlay")).toBeTruthy();
    });

    it("should dismiss game overlay on try again", async () => {
      const store = createGameOverStore();
      const { getByTestId, queryByTestId } = await renderWithProviders(store);

      expect(getByTestId("game-overlay")).toBeTruthy();

      await fireEvent.press(getByTestId("try-again-button"));

      const game = store.get(resolvedStoreAtom).currentGame;
      expect(game.score).toBe(0);
      expect(game.isGameOver).toBe(false);
      expect(game.moveCount).toBe(0);

      // The overlay should no longer be visible
      expect(queryByTestId("game-overlay")).toBeNull();
    });
  });
});

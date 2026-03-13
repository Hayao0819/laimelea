import { act, fireEvent, render } from "@testing-library/react-native";
import { createStore, Provider as JotaiProvider } from "jotai";
import React from "react";
import { PaperProvider } from "react-native-paper";

import { settingsAtom } from "../../../../src/atoms/settingsAtoms";
import {
  game2048StoreAtom,
  resolvedStoreAtom,
} from "../../../../src/features/game2048/atoms/game2048Atoms";
import { createDefaultStore } from "../../../../src/features/game2048/logic/gameEngine";
import type { GameSnapshot } from "../../../../src/features/game2048/logic/gameTypes";
import { Game2048TreeScreen } from "../../../../src/features/game2048/screens/Game2048TreeScreen";
import { DEFAULT_SETTINGS } from "../../../../src/models/Settings";

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

jest.mock("date-fns", () => ({
  format: jest.fn(() => "03/01 12:00"),
}));

function makeSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    id: "test-1",
    name: "Test Save",
    state: {
      board: [
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 4],
      ],
      score: 100,
      boardSize: 4,
      isGameOver: false,
      hasWon: false,
      wonAcknowledged: false,
      moveCount: 10,
    },
    timestamp: 1700000000000,
    parentSnapshotId: null,
    ...overrides,
  };
}

function createInitializedStore(
  snapshots: GameSnapshot[] = [],
  activeSnapshotId: string | null = null,
) {
  const store = createStore();
  store.set(settingsAtom, DEFAULT_SETTINGS);
  const defaultGame = createDefaultStore();
  store.set(game2048StoreAtom, {
    ...defaultGame,
    snapshots,
    activeSnapshotId,
  });
  return store;
}

async function renderWithProviders(store = createInitializedStore()) {
  const utils = render(
    <JotaiProvider store={store}>
      <PaperProvider>
        <Game2048TreeScreen />
      </PaperProvider>
    </JotaiProvider>,
  );
  await act(async () => {});
  return { store, ...utils };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Game2048TreeScreen", () => {
  it("should render the screen correctly", async () => {
    const { getByTestId, getByText } = await renderWithProviders();
    expect(getByTestId("game-2048-tree-screen")).toBeTruthy();
    expect(getByText("game2048.snapshotTree")).toBeTruthy();
  });

  it("should show empty message when no snapshots", async () => {
    const { getByTestId } = await renderWithProviders();
    expect(getByTestId("snapshot-tree-empty")).toBeTruthy();
  });

  it("should pass snapshots to SnapshotTree", async () => {
    const snapshots = [
      makeSnapshot({ id: "s1", name: "Save A" }),
      makeSnapshot({ id: "s2", name: "Save B" }),
    ];
    const { getByText } = await renderWithProviders(
      createInitializedStore(snapshots),
    );
    expect(getByText("Save A")).toBeTruthy();
    expect(getByText("Save B")).toBeTruthy();
  });

  it("should load snapshot via loadSnapshotAtom when a node is tapped", async () => {
    const snapshot = makeSnapshot({ id: "load-me", name: "Load Me" });
    const jotaiStore = createInitializedStore([snapshot]);
    const { getByTestId } = await renderWithProviders(jotaiStore);

    await fireEvent(getByTestId("tree-node-load-me"), "touchEnd");

    // After loading, activeSnapshotId should be updated
    const storeValue = jotaiStore.get(resolvedStoreAtom);
    expect(storeValue.activeSnapshotId).toBe("load-me");
  });

  it("should delete snapshot and update store", async () => {
    const snapshots = [
      makeSnapshot({ id: "keep", name: "Keep" }),
      makeSnapshot({ id: "remove", name: "Remove" }),
    ];
    const jotaiStore = createInitializedStore(snapshots, "remove");
    const { getByTestId } = await renderWithProviders(jotaiStore);

    await fireEvent.press(getByTestId("delete-tree-remove"));

    const storeValue = jotaiStore.get(resolvedStoreAtom);
    expect(storeValue.snapshots).toHaveLength(1);
    expect(storeValue.snapshots[0].id).toBe("keep");
    // Active snapshot was deleted, so it should be null
    expect(storeValue.activeSnapshotId).toBeNull();
  });
});

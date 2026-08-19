import AsyncStorage from "@react-native-async-storage/async-storage";
import { createStore } from "jotai";

import {
  activeSnapshotIdAtom,
  bestScoresAtom,
  canUndoAtom,
  currentGameAtom,
  game2048StoreAtom,
  hasGameStartedAtom,
  isUnlockedAtom,
  loadSnapshotAtom,
  milestoneAutoSaveAtom,
  newGameAtom,
  normalizeGame2048Store,
  pushHistoryAtom,
  resolvedStoreAtom,
  saveSnapshotAtom,
  settingsAtom,
  snapshotsAtom,
  switchBoardSizeAtom,
  undoAtom,
  updateSettingsAtom,
} from "../../../../src/features/game2048/atoms/game2048Atoms";
import {
  createDefaultStore,
  getMaxTile,
  MAX_HISTORY_SIZE,
} from "../../../../src/features/game2048/logic/gameEngine";
import type {
  BoardSize,
  Game2048Store,
  GameSnapshot,
  GameState,
} from "../../../../src/features/game2048/logic/gameTypes";

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

function createInitializedStore(overrides: Partial<Game2048Store> = {}) {
  const store = createStore();
  const defaultData = createDefaultStore();
  store.set(game2048StoreAtom, { ...defaultData, ...overrides });
  return store;
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    board: [
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 2],
    ],
    score: 0,
    boardSize: 4,
    isGameOver: false,
    hasWon: false,
    wonAcknowledged: false,
    moveCount: 0,
    ...overrides,
  };
}

function makeBoardOfSize(size: BoardSize): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0) as number[]);
}

describe("game2048Atoms", () => {
  describe("resolvedStoreAtom", () => {
    it("should return default store initially", () => {
      const store = createInitializedStore();
      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.bestScores).toEqual({ 3: 0, 4: 0, 5: 0, 6: 0 });
      expect(resolved.history).toEqual([]);
      expect(resolved.snapshots).toEqual([]);
      expect(resolved.unlockedAt).toBeNull();
      expect(resolved.currentGame.boardSize).toBe(4);
      expect(resolved.currentGame.score).toBe(0);
      expect(resolved.currentGame.isGameOver).toBe(false);
    });

    it("should merge defaults with stored data", () => {
      const store = createInitializedStore({
        bestScores: { 3: 100, 4: 200, 5: 0, 6: 0 },
        unlockedAt: 1234567890,
      });
      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.bestScores).toEqual({ 3: 100, 4: 200, 5: 0, 6: 0 });
      expect(resolved.unlockedAt).toBe(1234567890);
      // Default fields still present
      expect(resolved.history).toEqual([]);
      expect(resolved.snapshots).toEqual([]);
    });
  });

  describe("persisted state normalization", () => {
    it("replaces malformed values and dangling snapshot references", () => {
      const validSnapshot = {
        id: "valid-snapshot",
        name: "Save",
        state: makeGameState(),
        timestamp: 1_700_000_000_000,
        parentSnapshotId: "missing-snapshot",
      };
      const normalized = normalizeGame2048Store({
        currentGame: {
          ...makeGameState(),
          board: [[2, 0, 0, 0]],
        },
        bestScores: { 3: 10, 4: -1, 5: "bad", 6: 30 },
        history: [{ ...makeGameState(), boardSize: 5 }],
        snapshots: [
          validSnapshot,
          { ...validSnapshot, id: "valid-snapshot" },
          { ...validSnapshot, id: "invalid-snapshot", state: "bad" },
        ],
        unlockedAt: -1,
        perSizeGames: {
          4: { game: makeGameState(), history: [makeGameState()] },
          5: { game: makeGameState(), history: [] },
        },
        settings: { luckyMode: "yes" },
        activeSnapshotId: "missing-snapshot",
        autoSaveMaxTile: { 3: 8, 4: Infinity, 5: 32, 6: -2 },
      });

      expect(normalized.currentGame).toMatchObject({
        boardSize: 4,
        score: 0,
      });
      expect(normalized.bestScores).toEqual({ 3: 10, 4: 0, 5: 0, 6: 30 });
      expect(normalized.history).toEqual([]);
      expect(normalized.snapshots).toEqual([
        expect.objectContaining({
          id: "valid-snapshot",
          parentSnapshotId: null,
        }),
      ]);
      expect(normalized.unlockedAt).toBeNull();
      expect(normalized.perSizeGames).toEqual({
        4: expect.objectContaining({ history: [makeGameState()] }),
      });
      expect(normalized.settings).toEqual({ luckyMode: false });
      expect(normalized.activeSnapshotId).toBeNull();
      // currentGame was malformed and fell back to a freshly created game,
      // so autoSaveMaxTile[4] is reseeded from that board's actual max tile
      // instead of staying at the invalid stored value.
      expect(normalized.autoSaveMaxTile).toEqual({
        3: 8,
        4: getMaxTile(normalized.currentGame.board),
        5: 32,
        6: 0,
      });
      expect([2, 4]).toContain(normalized.autoSaveMaxTile[4]);
    });

    it("breaks cyclic snapshot parent references", () => {
      const normalized = normalizeGame2048Store({
        ...createDefaultStore(),
        snapshots: [
          {
            id: "first",
            name: "First",
            state: makeGameState(),
            timestamp: 1,
            parentSnapshotId: "second",
          },
          {
            id: "second",
            name: "Second",
            state: makeGameState(),
            timestamp: 2,
            parentSnapshotId: "first",
          },
        ],
      });

      expect(
        normalized.snapshots.map((snapshot) => snapshot.parentSnapshotId),
      ).toEqual([null, null]);
    });

    it("seeds autoSaveMaxTile from the board when a legacy backup lacks the key entirely", () => {
      const legacyGame = makeGameState({
        board: [
          [512, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 8000,
        boardSize: 4,
      });

      const normalized = normalizeGame2048Store({
        currentGame: legacyGame,
        bestScores: { 3: 0, 4: 8000, 5: 0, 6: 0 },
        history: [],
        snapshots: [],
        unlockedAt: null,
        perSizeGames: {},
        settings: { luckyMode: false },
        activeSnapshotId: null,
      });

      expect(normalized.autoSaveMaxTile[4]).toBe(512);
    });

    it("does not create a spurious milestone on the first move after restoring a legacy backup", () => {
      const legacyGame = makeGameState({
        board: [
          [512, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 8000,
        boardSize: 4,
      });
      const legacyStore = {
        currentGame: legacyGame,
        bestScores: { 3: 0, 4: 8000, 5: 0, 6: 0 },
        history: [],
        snapshots: [],
        unlockedAt: null,
        perSizeGames: {},
        settings: { luckyMode: false },
        activeSnapshotId: null,
      };

      const store = createStore();
      store.set(game2048StoreAtom, legacyStore as unknown as Game2048Store);

      const nextMoveState = {
        ...legacyGame,
        moveCount: legacyGame.moveCount + 1,
      };
      store.set(milestoneAutoSaveAtom, nextMoveState);

      expect(store.get(snapshotsAtom)).toHaveLength(0);
    });
  });

  describe("derived read atoms", () => {
    it("currentGameAtom should return store.currentGame", () => {
      const customGame = makeGameState({ score: 42, moveCount: 5 });
      const store = createInitializedStore({ currentGame: customGame });
      const game = store.get(currentGameAtom);
      expect(game.score).toBe(42);
      expect(game.moveCount).toBe(5);
      expect(game.board).toEqual(customGame.board);
    });

    it("bestScoresAtom should return store.bestScores", () => {
      const scores = { 3: 512, 4: 2048, 5: 100, 6: 0 } as Record<
        BoardSize,
        number
      >;
      const store = createInitializedStore({ bestScores: scores });
      expect(store.get(bestScoresAtom)).toEqual(scores);
    });

    it("canUndoAtom should be false when history is empty", () => {
      const store = createInitializedStore({ history: [] });
      expect(store.get(canUndoAtom)).toBe(false);
    });

    it("canUndoAtom should be true when history has entries", () => {
      const store = createInitializedStore({
        history: [makeGameState()],
      });
      expect(store.get(canUndoAtom)).toBe(true);
    });

    it("snapshotsAtom should return store.snapshots", () => {
      const snapshots = [
        {
          id: "snap-1",
          name: "Test",
          state: makeGameState(),
          timestamp: Date.now(),
          parentSnapshotId: null,
        },
      ];
      const store = createInitializedStore({ snapshots });
      expect(store.get(snapshotsAtom)).toEqual(snapshots);
    });

    it("isUnlockedAtom should be false when unlockedAt is null", () => {
      const store = createInitializedStore({ unlockedAt: null });
      expect(store.get(isUnlockedAtom)).toBe(false);
    });

    it("isUnlockedAtom should be true when unlockedAt is set", () => {
      const store = createInitializedStore({ unlockedAt: 1700000000000 });
      expect(store.get(isUnlockedAtom)).toBe(true);
    });
  });

  describe("pushHistoryAtom", () => {
    it("should set new currentGame and push previous to history", () => {
      const initialGame = makeGameState({ score: 10, moveCount: 1 });
      const store = createInitializedStore({
        currentGame: initialGame,
        history: [],
      });

      const newState = makeGameState({ score: 20, moveCount: 2 });
      store.set(pushHistoryAtom, newState);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.currentGame).toEqual(newState);
      expect(resolved.history).toHaveLength(1);
      expect(resolved.history[0]).toEqual(initialGame);
    });

    it("should update bestScore when new score is higher", () => {
      const store = createInitializedStore({
        bestScores: { 3: 0, 4: 100, 5: 0, 6: 0 },
      });

      const newState = makeGameState({ score: 500, boardSize: 4 });
      store.set(pushHistoryAtom, newState);

      expect(store.get(bestScoresAtom)[4]).toBe(500);
    });

    it("should not downgrade bestScore when new score is lower", () => {
      const store = createInitializedStore({
        bestScores: { 3: 0, 4: 1000, 5: 0, 6: 0 },
      });

      const newState = makeGameState({ score: 200, boardSize: 4 });
      store.set(pushHistoryAtom, newState);

      expect(store.get(bestScoresAtom)[4]).toBe(1000);
    });

    it("should cap history at MAX_HISTORY_SIZE", () => {
      const fullHistory = Array.from({ length: MAX_HISTORY_SIZE }, (_, i) =>
        makeGameState({ score: i, moveCount: i }),
      );
      const currentGame = makeGameState({
        score: MAX_HISTORY_SIZE,
        moveCount: MAX_HISTORY_SIZE,
      });
      const store = createInitializedStore({
        currentGame,
        history: fullHistory,
      });

      const newState = makeGameState({
        score: MAX_HISTORY_SIZE + 1,
        moveCount: MAX_HISTORY_SIZE + 1,
      });
      store.set(pushHistoryAtom, newState);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.history).toHaveLength(MAX_HISTORY_SIZE);
      // The oldest entry (score=0) should have been evicted
      expect(resolved.history[0].score).toBe(1);
      // The last entry should be the previous currentGame
      expect(resolved.history[MAX_HISTORY_SIZE - 1]).toEqual(currentGame);
    });

    it("should update bestScore for the correct board size", () => {
      const store = createInitializedStore({
        bestScores: { 3: 50, 4: 100, 5: 200, 6: 300 },
      });

      const newState = makeGameState({ score: 999, boardSize: 3 });
      store.set(pushHistoryAtom, newState);

      const scores = store.get(bestScoresAtom);
      expect(scores[3]).toBe(999);
      // Other sizes remain unchanged
      expect(scores[4]).toBe(100);
      expect(scores[5]).toBe(200);
      expect(scores[6]).toBe(300);
    });
  });

  describe("undoAtom", () => {
    it("should restore the last state from history", () => {
      const prevState = makeGameState({ score: 10, moveCount: 1 });
      const currentGame = makeGameState({ score: 20, moveCount: 2 });
      const store = createInitializedStore({
        currentGame,
        history: [prevState],
      });

      store.set(undoAtom);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.currentGame).toEqual(prevState);
    });

    it("should do nothing when history is empty", () => {
      const currentGame = makeGameState({ score: 50, moveCount: 3 });
      const store = createInitializedStore({
        currentGame,
        history: [],
      });

      store.set(undoAtom);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.currentGame).toEqual(currentGame);
      expect(resolved.history).toEqual([]);
    });

    it("should remove the restored state from history", () => {
      const state1 = makeGameState({ score: 10, moveCount: 1 });
      const state2 = makeGameState({ score: 20, moveCount: 2 });
      const currentGame = makeGameState({ score: 30, moveCount: 3 });
      const store = createInitializedStore({
        currentGame,
        history: [state1, state2],
      });

      store.set(undoAtom);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.currentGame).toEqual(state2);
      expect(resolved.history).toHaveLength(1);
      expect(resolved.history[0]).toEqual(state1);
    });

    it("should restore through multiple undos", () => {
      const state1 = makeGameState({ score: 10, moveCount: 1 });
      const state2 = makeGameState({ score: 20, moveCount: 2 });
      const currentGame = makeGameState({ score: 30, moveCount: 3 });
      const store = createInitializedStore({
        currentGame,
        history: [state1, state2],
      });

      store.set(undoAtom);
      store.set(undoAtom);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.currentGame).toEqual(state1);
      expect(resolved.history).toHaveLength(0);
    });
  });

  describe("newGameAtom", () => {
    it("should create a new game with specified size", () => {
      const store = createInitializedStore();

      store.set(newGameAtom, 5);

      const game = store.get(currentGameAtom);
      expect(game.boardSize).toBe(5);
      expect(game.board).toHaveLength(5);
      expect(game.board[0]).toHaveLength(5);
      expect(game.score).toBe(0);
      expect(game.isGameOver).toBe(false);
      expect(game.moveCount).toBe(0);
    });

    it("should clear history when starting new game", () => {
      const store = createInitializedStore({
        history: [makeGameState(), makeGameState({ score: 10 })],
      });

      store.set(newGameAtom, 4);

      expect(store.get(resolvedStoreAtom).history).toEqual([]);
    });

    it("should not affect bestScores", () => {
      const scores = { 3: 100, 4: 500, 5: 200, 6: 0 } as Record<
        BoardSize,
        number
      >;
      const store = createInitializedStore({ bestScores: scores });

      store.set(newGameAtom, 4);

      expect(store.get(bestScoresAtom)).toEqual(scores);
    });

    it("should not affect unlockedAt", () => {
      const store = createInitializedStore({ unlockedAt: 1700000000000 });

      store.set(newGameAtom, 4);

      expect(store.get(isUnlockedAtom)).toBe(true);
      expect(store.get(resolvedStoreAtom).unlockedAt).toBe(1700000000000);
    });

    it("should not affect snapshots", () => {
      const snapshots = [
        {
          id: "s1",
          name: "Save 1",
          state: makeGameState(),
          timestamp: 1000,
          parentSnapshotId: null,
        },
      ];
      const store = createInitializedStore({ snapshots });

      store.set(newGameAtom, 3);

      expect(store.get(snapshotsAtom)).toEqual(snapshots);
    });

    it("should reset activeSnapshotId to null", () => {
      const store = createInitializedStore({
        activeSnapshotId: "some-snapshot-id",
      });

      store.set(newGameAtom, 4);

      expect(store.get(activeSnapshotIdAtom)).toBeNull();
    });

    it("restores the previous store when persistence fails", async () => {
      const initial = createDefaultStore();
      const store = createStore();
      await Promise.resolve(store.set(game2048StoreAtom, initial));
      jest
        .mocked(AsyncStorage.setItem)
        .mockRejectedValueOnce(new Error("storage unavailable"));

      await expect(
        Promise.resolve(store.set(newGameAtom, 3)),
      ).resolves.toBeUndefined();

      expect(store.get(resolvedStoreAtom)).toEqual(initial);
    });
  });

  describe("settingsAtom", () => {
    it("should return default settings", () => {
      const store = createInitializedStore();
      expect(store.get(settingsAtom)).toEqual({ luckyMode: false });
    });

    it("should return stored settings", () => {
      const store = createInitializedStore({
        settings: { luckyMode: true },
      });
      expect(store.get(settingsAtom)).toEqual({ luckyMode: true });
    });
  });

  describe("hasGameStartedAtom", () => {
    it("should be false when moveCount is 0", () => {
      const store = createInitializedStore({
        currentGame: makeGameState({ moveCount: 0 }),
      });
      expect(store.get(hasGameStartedAtom)).toBe(false);
    });

    it("should be true when moveCount > 0", () => {
      const store = createInitializedStore({
        currentGame: makeGameState({ moveCount: 1 }),
      });
      expect(store.get(hasGameStartedAtom)).toBe(true);
    });

    it("should be true when moveCount is large", () => {
      const store = createInitializedStore({
        currentGame: makeGameState({ moveCount: 100 }),
      });
      expect(store.get(hasGameStartedAtom)).toBe(true);
    });
  });

  describe("activeSnapshotIdAtom", () => {
    it("should be null by default", () => {
      const store = createInitializedStore();
      expect(store.get(activeSnapshotIdAtom)).toBeNull();
    });

    it("should return stored activeSnapshotId", () => {
      const store = createInitializedStore({
        activeSnapshotId: "snap-123",
        snapshots: [
          {
            id: "snap-123",
            name: "Save",
            state: makeGameState(),
            timestamp: 1,
            parentSnapshotId: null,
          },
        ],
      });
      expect(store.get(activeSnapshotIdAtom)).toBe("snap-123");
    });
  });

  describe("updateSettingsAtom", () => {
    it("should update luckyMode to true", () => {
      const store = createInitializedStore();
      expect(store.get(settingsAtom).luckyMode).toBe(false);

      store.set(updateSettingsAtom, { luckyMode: true });

      expect(store.get(settingsAtom).luckyMode).toBe(true);
    });

    it("should update luckyMode back to false", () => {
      const store = createInitializedStore({
        settings: { luckyMode: true },
      });

      store.set(updateSettingsAtom, { luckyMode: false });

      expect(store.get(settingsAtom).luckyMode).toBe(false);
    });

    it("should not affect other store fields", () => {
      const store = createInitializedStore({
        bestScores: { 3: 100, 4: 200, 5: 0, 6: 0 },
      });

      store.set(updateSettingsAtom, { luckyMode: true });

      expect(store.get(bestScoresAtom)).toEqual({
        3: 100,
        4: 200,
        5: 0,
        6: 0,
      });
    });
  });

  describe("switchBoardSizeAtom", () => {
    it("should save current game to perSizeGames and create new game for new size", () => {
      const game4 = makeGameState({ score: 42, moveCount: 5, boardSize: 4 });
      const history4 = [makeGameState({ score: 10, moveCount: 1 })];
      const store = createInitializedStore({
        currentGame: game4,
        history: history4,
      });

      store.set(switchBoardSizeAtom, 5);

      const resolved = store.get(resolvedStoreAtom);
      // New game should be size 5
      expect(resolved.currentGame.boardSize).toBe(5);
      expect(resolved.currentGame.score).toBe(0);
      expect(resolved.currentGame.moveCount).toBe(0);
      // History should be empty for new game
      expect(resolved.history).toEqual([]);
      // Previous game should be saved in perSizeGames
      expect(resolved.perSizeGames[4]).toBeDefined();
      expect(resolved.perSizeGames[4]!.game).toEqual(game4);
      expect(resolved.perSizeGames[4]!.history).toEqual(history4);
    });

    it("should restore saved game when switching back to a previous size", () => {
      const game4 = makeGameState({ score: 42, moveCount: 5, boardSize: 4 });
      const history4 = [makeGameState({ score: 10, moveCount: 1 })];
      const store = createInitializedStore({
        currentGame: game4,
        history: history4,
      });

      // Switch to 5
      store.set(switchBoardSizeAtom, 5);
      // Switch back to 4
      store.set(switchBoardSizeAtom, 4);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.currentGame).toEqual(game4);
      expect(resolved.history).toEqual(history4);
      // Size 4 should no longer be in perSizeGames (loaded out)
      expect(resolved.perSizeGames[4]).toBeUndefined();
      // Size 5 game should be saved
      expect(resolved.perSizeGames[5]).toBeDefined();
    });

    it("should do nothing when switching to the same size", () => {
      const game4 = makeGameState({ score: 42, moveCount: 5, boardSize: 4 });
      const store = createInitializedStore({
        currentGame: game4,
        history: [],
      });

      store.set(switchBoardSizeAtom, 4);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.currentGame).toEqual(game4);
      expect(resolved.perSizeGames).toEqual({});
    });

    it("should reset activeSnapshotId to null", () => {
      const store = createInitializedStore({
        activeSnapshotId: "snap-123",
      });

      store.set(switchBoardSizeAtom, 5);

      expect(store.get(activeSnapshotIdAtom)).toBeNull();
    });

    it("should preserve bestScores and snapshots when switching", () => {
      const scores = { 3: 100, 4: 500, 5: 200, 6: 0 } as Record<
        BoardSize,
        number
      >;
      const snapshots: GameSnapshot[] = [
        {
          id: "s1",
          name: "Save 1",
          state: makeGameState(),
          timestamp: 1000,
          parentSnapshotId: null,
        },
      ];
      const store = createInitializedStore({
        bestScores: scores,
        snapshots,
      });

      store.set(switchBoardSizeAtom, 5);

      expect(store.get(bestScoresAtom)).toEqual(scores);
      expect(store.get(snapshotsAtom)).toEqual(snapshots);
    });
  });

  describe("saveSnapshotAtom", () => {
    it("should create a manual save snapshot with correct name", () => {
      const game = makeGameState({ score: 100, boardSize: 4 });
      const store = createInitializedStore({ currentGame: game });

      store.set(saveSnapshotAtom, false);

      const snapshots = store.get(snapshotsAtom);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].name).toBe("Save #1 · 100pt · 4×4");
      expect(snapshots[0].state).toEqual(game);
    });

    it("should create an auto-save snapshot with Game Over prefix", () => {
      const game = makeGameState({
        score: 500,
        boardSize: 4,
        isGameOver: true,
      });
      const store = createInitializedStore({ currentGame: game });

      store.set(saveSnapshotAtom, true);

      const snapshots = store.get(snapshotsAtom);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].name).toBe("Game Over #1 · 500pt · 4×4");
    });

    it("should increment index for same type of snapshots", () => {
      const game = makeGameState({ score: 200, boardSize: 4 });
      const store = createInitializedStore({
        currentGame: game,
        snapshots: [
          {
            id: "existing-1",
            name: "Save #1 · 100pt · 4×4",
            state: makeGameState({ score: 100 }),
            timestamp: 1000,
            parentSnapshotId: null,
          },
        ],
      });

      store.set(saveSnapshotAtom, false);

      const snapshots = store.get(snapshotsAtom);
      expect(snapshots).toHaveLength(2);
      expect(snapshots[1].name).toBe("Save #2 · 200pt · 4×4");
    });

    it("should set parentSnapshotId to current activeSnapshotId", () => {
      const store = createInitializedStore({
        activeSnapshotId: "parent-snap",
        snapshots: [
          {
            id: "parent-snap",
            name: "Save",
            state: makeGameState(),
            timestamp: 1,
            parentSnapshotId: null,
          },
        ],
      });

      store.set(saveSnapshotAtom, false);

      const snapshots = store.get(snapshotsAtom);
      expect(snapshots[1].parentSnapshotId).toBe("parent-snap");
    });

    it("should set parentSnapshotId to null when no active snapshot", () => {
      const store = createInitializedStore({
        activeSnapshotId: null,
      });

      store.set(saveSnapshotAtom, false);

      const snapshots = store.get(snapshotsAtom);
      expect(snapshots[0].parentSnapshotId).toBeNull();
    });

    it("should update activeSnapshotId to the new snapshot ID", () => {
      const store = createInitializedStore();

      store.set(saveSnapshotAtom, false);

      const snapshots = store.get(snapshotsAtom);
      const newId = snapshots[0].id;
      expect(store.get(activeSnapshotIdAtom)).toBe(newId);
    });
  });

  describe("loadSnapshotAtom", () => {
    it("should restore snapshot state as currentGame", () => {
      const savedGame = makeGameState({ score: 999, moveCount: 50 });
      const snapshot: GameSnapshot = {
        id: "snap-load",
        name: "Save #1 · 999pt · 4×4",
        state: savedGame,
        timestamp: 1000,
        parentSnapshotId: null,
      };
      const store = createInitializedStore();

      store.set(loadSnapshotAtom, snapshot);

      const game = store.get(currentGameAtom);
      expect(game).toEqual(savedGame);
    });

    it("should clear history when loading a snapshot", () => {
      const snapshot: GameSnapshot = {
        id: "snap-load",
        name: "Save #1",
        state: makeGameState(),
        timestamp: 1000,
        parentSnapshotId: null,
      };
      const store = createInitializedStore({
        history: [makeGameState({ score: 10 }), makeGameState({ score: 20 })],
      });

      store.set(loadSnapshotAtom, snapshot);

      expect(store.get(resolvedStoreAtom).history).toEqual([]);
    });

    it("should set activeSnapshotId to the loaded snapshot ID", () => {
      const snapshot: GameSnapshot = {
        id: "snap-load-42",
        name: "Save #1",
        state: makeGameState(),
        timestamp: 1000,
        parentSnapshotId: null,
      };
      const store = createInitializedStore({ snapshots: [snapshot] });

      store.set(loadSnapshotAtom, snapshot);

      expect(store.get(activeSnapshotIdAtom)).toBe("snap-load-42");
    });

    it("should not affect bestScores or other store fields", () => {
      const scores = { 3: 100, 4: 500, 5: 200, 6: 0 } as Record<
        BoardSize,
        number
      >;
      const snapshot: GameSnapshot = {
        id: "snap-1",
        name: "Save #1",
        state: makeGameState(),
        timestamp: 1000,
        parentSnapshotId: null,
      };
      const store = createInitializedStore({ bestScores: scores });

      store.set(loadSnapshotAtom, snapshot);

      expect(store.get(bestScoresAtom)).toEqual(scores);
    });

    it("should update autoSaveMaxTile for the loaded board size", () => {
      const savedGame = makeGameState({
        board: [
          [2, 4, 8, 16],
          [32, 64, 128, 256],
          [512, 1024, 2048, 0],
          [0, 0, 0, 0],
        ],
        boardSize: 4,
      });
      const snapshot: GameSnapshot = {
        id: "snap-load-milestone",
        name: "Save #1",
        state: savedGame,
        timestamp: 1000,
        parentSnapshotId: null,
      };
      const store = createInitializedStore({
        autoSaveMaxTile: { 3: 0, 4: 0, 5: 0, 6: 0 },
      });

      store.set(loadSnapshotAtom, snapshot);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.autoSaveMaxTile[4]).toBe(2048);
      // Other sizes unaffected
      expect(resolved.autoSaveMaxTile[3]).toBe(0);
      expect(resolved.autoSaveMaxTile[5]).toBe(0);
      expect(resolved.autoSaveMaxTile[6]).toBe(0);
    });
  });

  describe("milestoneAutoSaveAtom", () => {
    it("should create a snapshot when a new max tile is achieved", () => {
      const store = createInitializedStore({
        autoSaveMaxTile: { 3: 0, 4: 4, 5: 0, 6: 0 },
      });

      const newState = makeGameState({
        board: [
          [2, 4, 8, 16],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 100,
        boardSize: 4,
      });

      store.set(milestoneAutoSaveAtom, newState);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.snapshots).toHaveLength(1);
      expect(resolved.snapshots[0].name).toBe("Reached 16 #1 · 100pt · 4×4");
      expect(resolved.snapshots[0].state).toEqual(newState);
      expect(resolved.autoSaveMaxTile[4]).toBe(16);
    });

    it("should not create a snapshot when max tile has not increased", () => {
      const store = createInitializedStore({
        autoSaveMaxTile: { 3: 0, 4: 16, 5: 0, 6: 0 },
      });

      const newState = makeGameState({
        board: [
          [2, 4, 8, 16],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 100,
        boardSize: 4,
      });

      store.set(milestoneAutoSaveAtom, newState);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.snapshots).toHaveLength(0);
      expect(resolved.autoSaveMaxTile[4]).toBe(16);
    });

    it("should not create a snapshot when max tile is lower than recorded", () => {
      const store = createInitializedStore({
        autoSaveMaxTile: { 3: 0, 4: 32, 5: 0, 6: 0 },
      });

      const newState = makeGameState({
        board: [
          [2, 4, 8, 16],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 50,
        boardSize: 4,
      });

      store.set(milestoneAutoSaveAtom, newState);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.snapshots).toHaveLength(0);
    });

    it("should increment Reached index correctly with existing milestone snapshots", () => {
      const store = createInitializedStore({
        autoSaveMaxTile: { 3: 0, 4: 8, 5: 0, 6: 0 },
        snapshots: [
          {
            id: "existing-milestone",
            name: "Reached 8 #1 · 50pt · 4×4",
            state: makeGameState(),
            timestamp: 1000,
            parentSnapshotId: null,
          },
        ],
      });

      const newState = makeGameState({
        board: [
          [2, 4, 8, 16],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 100,
        boardSize: 4,
      });

      store.set(milestoneAutoSaveAtom, newState);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.snapshots).toHaveLength(2);
      expect(resolved.snapshots[1].name).toBe("Reached 16 #2 · 100pt · 4×4");
    });

    it("should update activeSnapshotId to the new milestone snapshot", () => {
      const store = createInitializedStore({
        autoSaveMaxTile: { 3: 0, 4: 2, 5: 0, 6: 0 },
      });

      const newState = makeGameState({
        board: [
          [4, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        boardSize: 4,
      });

      store.set(milestoneAutoSaveAtom, newState);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.activeSnapshotId).toBe(resolved.snapshots[0].id);
    });

    it("should track milestones per board size independently", () => {
      const store = createInitializedStore({
        autoSaveMaxTile: { 3: 64, 4: 4, 5: 0, 6: 0 },
      });

      // New max on size 4 but not on size 3
      const newState = makeGameState({
        board: [
          [2, 4, 8, 16],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 100,
        boardSize: 4,
      });

      store.set(milestoneAutoSaveAtom, newState);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.snapshots).toHaveLength(1);
      expect(resolved.autoSaveMaxTile[4]).toBe(16);
      // Size 3 should be unaffected
      expect(resolved.autoSaveMaxTile[3]).toBe(64);
    });
  });

  describe("createDefaultStore autoSaveMaxTile seeding", () => {
    it("seeds autoSaveMaxTile[4] from the initial board so the first move creates no spurious milestone snapshot", () => {
      const defaultData = createDefaultStore();
      const initialMaxTile = getMaxTile(defaultData.currentGame.board);
      expect(defaultData.autoSaveMaxTile[4]).toBe(initialMaxTile);

      const store = createInitializedStore(defaultData);
      const newState = { ...defaultData.currentGame, moveCount: 1 };

      store.set(milestoneAutoSaveAtom, newState);

      expect(store.get(snapshotsAtom)).toHaveLength(0);
    });
  });

  describe("switchBoardSizeAtom autoSaveMaxTile seeding", () => {
    it("seeds autoSaveMaxTile for a never-played size so the first move creates no spurious milestone snapshot", () => {
      const store = createInitializedStore();

      store.set(switchBoardSizeAtom, 5);

      const resolved = store.get(resolvedStoreAtom);
      const initialMaxTile = getMaxTile(resolved.currentGame.board);
      expect(resolved.autoSaveMaxTile[5]).toBe(initialMaxTile);

      store.set(milestoneAutoSaveAtom, {
        ...resolved.currentGame,
        moveCount: 1,
      });

      expect(store.get(snapshotsAtom)).toHaveLength(0);
    });

    it("does not reseed autoSaveMaxTile when switching to a previously played size", () => {
      const store = createInitializedStore({
        autoSaveMaxTile: { 3: 0, 4: 0, 5: 64, 6: 0 },
        perSizeGames: {
          5: {
            game: makeGameState({
              boardSize: 5,
              board: makeBoardOfSize(5),
            }),
            history: [],
          },
        },
      });

      store.set(switchBoardSizeAtom, 5);

      expect(store.get(resolvedStoreAtom).autoSaveMaxTile[5]).toBe(64);
    });
  });

  describe("loadSnapshotAtom perSizeGames archiving", () => {
    it("archives the outgoing game into perSizeGames and clears it again when the snapshot is the same size", () => {
      const currentGame = makeGameState({ score: 42, boardSize: 4 });
      const history = [makeGameState({ score: 10 })];
      const snapshot: GameSnapshot = {
        id: "snap-same-size",
        name: "Save #1",
        state: makeGameState({ score: 999, boardSize: 4 }),
        timestamp: 1000,
        parentSnapshotId: null,
      };
      const store = createInitializedStore({ currentGame, history });

      store.set(loadSnapshotAtom, snapshot);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.currentGame).toEqual(snapshot.state);
      expect(resolved.perSizeGames[4]).toBeUndefined();
    });

    it("archives the outgoing game and clears a stale entry when loading a different-size snapshot", () => {
      const currentGame = makeGameState({ score: 42, boardSize: 4 });
      const history = [makeGameState({ score: 10 })];
      const staleGame5 = makeGameState({
        score: 777,
        boardSize: 5,
        board: makeBoardOfSize(5),
      });
      const snapshot: GameSnapshot = {
        id: "snap-diff-size",
        name: "Save #1",
        state: makeGameState({
          score: 999,
          boardSize: 5,
          board: makeBoardOfSize(5),
        }),
        timestamp: 1000,
        parentSnapshotId: null,
      };
      const store = createInitializedStore({
        currentGame,
        history,
        perSizeGames: { 5: { game: staleGame5, history: [] } },
      });

      store.set(loadSnapshotAtom, snapshot);

      const resolved = store.get(resolvedStoreAtom);
      expect(resolved.currentGame).toEqual(snapshot.state);
      expect(resolved.perSizeGames[4]).toEqual({ game: currentGame, history });
      expect(resolved.perSizeGames[5]).toBeUndefined();
    });

    it("never leaves a perSizeGames entry for the newly active board size", () => {
      const snapshot: GameSnapshot = {
        id: "snap-invariant",
        name: "Save #1",
        state: makeGameState({
          score: 5,
          boardSize: 3,
          board: makeBoardOfSize(3),
        }),
        timestamp: 1000,
        parentSnapshotId: null,
      };
      const store = createInitializedStore({
        currentGame: makeGameState({ boardSize: 4 }),
      });

      store.set(loadSnapshotAtom, snapshot);

      const resolved = store.get(resolvedStoreAtom);
      expect(
        resolved.perSizeGames[resolved.currentGame.boardSize],
      ).toBeUndefined();
    });
  });

  describe("saveSnapshotAtom auto-save pruning", () => {
    it("prunes the oldest game-over auto-saves beyond the retention limit for that board size", () => {
      const manualSnapshot: GameSnapshot = {
        id: "manual-1",
        name: "Save #1 · 1pt · 4×4",
        state: makeGameState(),
        timestamp: 1,
        parentSnapshotId: null,
      };
      const milestoneSnapshot: GameSnapshot = {
        id: "milestone-1",
        name: "Reached 16 #1 · 1pt · 4×4",
        state: makeGameState(),
        timestamp: 2,
        parentSnapshotId: null,
      };
      const gameOverSnapshots: GameSnapshot[] = [1, 2, 3].map((n) => ({
        id: `gameover-${n}`,
        name: `Game Over #${n} · ${n}pt · 4×4`,
        state: makeGameState({ score: n }),
        timestamp: 100 + n,
        parentSnapshotId: null,
      }));
      const store = createInitializedStore({
        currentGame: makeGameState({
          score: 999,
          boardSize: 4,
          isGameOver: true,
        }),
        snapshots: [manualSnapshot, milestoneSnapshot, ...gameOverSnapshots],
      });

      store.set(saveSnapshotAtom, true);

      const snapshots = store.get(snapshotsAtom);
      const gameOverKept = snapshots.filter((snapshot) =>
        snapshot.name.startsWith("Game Over"),
      );
      expect(gameOverKept).toHaveLength(3);
      expect(
        gameOverKept.some((snapshot) => snapshot.id === "gameover-1"),
      ).toBe(false);
      expect(
        gameOverKept.some((snapshot) => snapshot.id === "gameover-3"),
      ).toBe(true);
      expect(snapshots.some((snapshot) => snapshot.id === "manual-1")).toBe(
        true,
      );
      expect(snapshots.some((snapshot) => snapshot.id === "milestone-1")).toBe(
        true,
      );
    });

    it("keeps all snapshots when landing exactly at the retention limit of 3", () => {
      const gameOverSnapshots: GameSnapshot[] = [1, 2].map((n) => ({
        id: `gameover-${n}`,
        name: `Game Over #${n} · ${n}pt · 4×4`,
        state: makeGameState({ score: n }),
        timestamp: 100 + n,
        parentSnapshotId: null,
      }));
      const store = createInitializedStore({
        currentGame: makeGameState({
          score: 999,
          boardSize: 4,
          isGameOver: true,
        }),
        snapshots: gameOverSnapshots,
      });

      store.set(saveSnapshotAtom, true);

      const snapshots = store.get(snapshotsAtom);
      const gameOverKept = snapshots.filter((snapshot) =>
        snapshot.name.startsWith("Game Over"),
      );
      expect(gameOverKept).toHaveLength(3);
      expect(gameOverKept.map((snapshot) => snapshot.id)).toEqual(
        expect.arrayContaining(["gameover-1", "gameover-2"]),
      );
    });

    it("only prunes game-over auto-saves for the matching board size", () => {
      const gameOverSize4 = [1, 2, 3].map((n) => ({
        id: `size4-${n}`,
        name: `Game Over #${n} · ${n}pt · 4×4`,
        state: makeGameState({ score: n, boardSize: 4 }),
        timestamp: 100 + n,
        parentSnapshotId: null,
      }));
      const gameOverSize5: GameSnapshot = {
        id: "size5-1",
        name: "Game Over #1 · 1pt · 5×5",
        state: makeGameState({
          score: 1,
          boardSize: 5,
          board: makeBoardOfSize(5),
        }),
        timestamp: 50,
        parentSnapshotId: null,
      };
      const store = createInitializedStore({
        currentGame: makeGameState({
          score: 999,
          boardSize: 4,
          isGameOver: true,
        }),
        snapshots: [...gameOverSize4, gameOverSize5],
      });

      store.set(saveSnapshotAtom, true);

      const snapshots = store.get(snapshotsAtom);
      expect(snapshots.some((snapshot) => snapshot.id === "size5-1")).toBe(
        true,
      );
    });
  });

  describe("snapshot name numbering after deletion", () => {
    it("saveSnapshotAtom does not reuse a deleted snapshot's number", () => {
      const store = createInitializedStore({
        snapshots: [
          {
            id: "s1",
            name: "Save #1 · 10pt · 4×4",
            state: makeGameState(),
            timestamp: 1,
            parentSnapshotId: null,
          },
          {
            id: "s3",
            name: "Save #3 · 30pt · 4×4",
            state: makeGameState(),
            timestamp: 3,
            parentSnapshotId: null,
          },
        ],
      });

      store.set(saveSnapshotAtom, false);

      const snapshots = store.get(snapshotsAtom);
      const newest = snapshots[snapshots.length - 1];
      expect(newest.name).toBe("Save #4 · 0pt · 4×4");
    });

    it("milestoneAutoSaveAtom does not reuse a deleted milestone's number", () => {
      const store = createInitializedStore({
        autoSaveMaxTile: { 3: 0, 4: 8, 5: 0, 6: 0 },
        snapshots: [
          {
            id: "m1",
            name: "Reached 8 #1 · 10pt · 4×4",
            state: makeGameState(),
            timestamp: 1,
            parentSnapshotId: null,
          },
          {
            id: "m3",
            name: "Reached 8 #3 · 30pt · 4×4",
            state: makeGameState(),
            timestamp: 3,
            parentSnapshotId: null,
          },
        ],
      });
      const newState = makeGameState({
        board: [
          [2, 4, 8, 16],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        score: 100,
        boardSize: 4,
      });

      store.set(milestoneAutoSaveAtom, newState);

      const snapshots = store.get(snapshotsAtom);
      const newest = snapshots[snapshots.length - 1];
      expect(newest.name).toBe("Reached 16 #4 · 100pt · 4×4");
    });
  });

  describe("isTileValue via normalizeGame2048Store", () => {
    it("rejects a board containing an invalid tile value of 1 and falls back to default", () => {
      const normalized = normalizeGame2048Store({
        currentGame: {
          ...makeGameState(),
          score: 999,
          board: [
            [1, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          ],
        },
      });

      expect(normalized.currentGame).toMatchObject({ boardSize: 4, score: 0 });
      expect(normalized.currentGame.board.flat()).not.toContain(1);
    });
  });

  describe("commitGameStoreAtom throwing updater guard", () => {
    it("does not reject when the updater throws, avoiding an unhandled rejection", async () => {
      const initial = createDefaultStore();
      const store = createStore();
      await Promise.resolve(store.set(game2048StoreAtom, initial));

      await expect(
        Promise.resolve(
          store.set(pushHistoryAtom, undefined as unknown as GameState),
        ),
      ).resolves.toBeUndefined();

      expect(store.get(resolvedStoreAtom)).toEqual(initial);
    });
  });

  describe("game2048StoreAtom no-op write skip", () => {
    it("does not write to storage when the updater returns the identical reference", async () => {
      const initial = createDefaultStore();
      const store = createStore();
      await Promise.resolve(store.set(game2048StoreAtom, initial));
      jest.mocked(AsyncStorage.setItem).mockClear();

      await Promise.resolve(
        store.set(game2048StoreAtom, (previous) => previous),
      );

      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it("does not write to storage when undo runs with an empty history", async () => {
      const initial = createDefaultStore();
      const store = createStore();
      await Promise.resolve(store.set(game2048StoreAtom, initial));
      jest.mocked(AsyncStorage.setItem).mockClear();

      await Promise.resolve(store.set(undoAtom));

      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe("newGameAtom autoSaveMaxTile reset", () => {
    it("should reset autoSaveMaxTile to initial board maxTile on new game", () => {
      const store = createInitializedStore({
        autoSaveMaxTile: { 3: 512, 4: 2048, 5: 4096, 6: 8192 },
      });

      store.set(newGameAtom, 4);

      const resolved = store.get(resolvedStoreAtom);
      const initialMaxTile = getMaxTile(resolved.currentGame.board);
      expect(resolved.autoSaveMaxTile[4]).toBe(initialMaxTile);
      // Initial tiles are 2 or 4, so maxTile should be 2 or 4
      expect([2, 4]).toContain(resolved.autoSaveMaxTile[4]);
      // Other sizes should remain unchanged
      expect(resolved.autoSaveMaxTile[3]).toBe(512);
      expect(resolved.autoSaveMaxTile[5]).toBe(4096);
      expect(resolved.autoSaveMaxTile[6]).toBe(8192);
    });

    it("should reset autoSaveMaxTile only for the specified board size", () => {
      const store = createInitializedStore({
        autoSaveMaxTile: { 3: 100, 4: 200, 5: 300, 6: 400 },
      });

      store.set(newGameAtom, 3);

      const resolved = store.get(resolvedStoreAtom);
      expect([2, 4]).toContain(resolved.autoSaveMaxTile[3]);
      expect(resolved.autoSaveMaxTile[4]).toBe(200);
      expect(resolved.autoSaveMaxTile[5]).toBe(300);
      expect(resolved.autoSaveMaxTile[6]).toBe(400);
    });
  });
});

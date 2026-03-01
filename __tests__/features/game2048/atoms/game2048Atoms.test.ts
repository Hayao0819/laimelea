import { createStore } from "jotai";
import {
  game2048StoreAtom,
  resolvedStoreAtom,
  currentGameAtom,
  bestScoresAtom,
  canUndoAtom,
  snapshotsAtom,
  isUnlockedAtom,
  pushHistoryAtom,
  undoAtom,
  newGameAtom,
} from "../../../../src/features/game2048/atoms/game2048Atoms";
import {
  createDefaultStore,
  MAX_HISTORY_SIZE,
} from "../../../../src/features/game2048/logic/gameEngine";
import type {
  BoardSize,
  Game2048Store,
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
  });
});

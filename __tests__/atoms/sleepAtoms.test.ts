import { createStore } from "jotai";
import {
  sleepSessionsAtom,
  cycleEstimationAtom,
  sleepLoadingAtom,
  sleepErrorAtom,
  sleepLastSyncAtom,
  sleepCacheStaleAtom,
  SLEEP_CACHE_TTL_MS,
} from "../../src/atoms/sleepAtoms";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

describe("sleepAtoms", () => {
  describe("SLEEP_CACHE_TTL_MS", () => {
    it("should be 10 minutes in milliseconds", () => {
      expect(SLEEP_CACHE_TTL_MS).toBe(10 * 60 * 1000);
      expect(SLEEP_CACHE_TTL_MS).toBe(600000);
    });
  });

  describe("sleepSessionsAtom", () => {
    it("should default to an empty array", () => {
      const store = createStore();
      // atomWithStorage needs explicit init for sync tests
      store.set(sleepSessionsAtom, []);
      expect(store.get(sleepSessionsAtom)).toEqual([]);
    });
  });

  describe("cycleEstimationAtom", () => {
    it("should default to null", () => {
      const store = createStore();
      expect(store.get(cycleEstimationAtom)).toBeNull();
    });
  });

  describe("sleepLoadingAtom", () => {
    it("should default to false", () => {
      const store = createStore();
      expect(store.get(sleepLoadingAtom)).toBe(false);
    });
  });

  describe("sleepErrorAtom", () => {
    it("should default to null", () => {
      const store = createStore();
      expect(store.get(sleepErrorAtom)).toBeNull();
    });
  });

  describe("sleepLastSyncAtom", () => {
    it("should default to null", () => {
      const store = createStore();
      expect(store.get(sleepLastSyncAtom)).toBeNull();
    });
  });

  describe("sleepCacheStaleAtom", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-03-01T12:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return true when lastSync is null (initial state)", () => {
      const store = createStore();
      expect(store.get(sleepCacheStaleAtom)).toBe(true);
    });

    it("should return false when lastSync is within TTL", () => {
      const store = createStore();
      const oneMinuteAgo = Date.now() - 1 * 60 * 1000;
      store.set(sleepLastSyncAtom, oneMinuteAgo);
      expect(store.get(sleepCacheStaleAtom)).toBe(false);
    });

    it("should return true when lastSync exceeds TTL", () => {
      const store = createStore();
      const elevenMinutesAgo = Date.now() - 11 * 60 * 1000;
      store.set(sleepLastSyncAtom, elevenMinutesAgo);
      expect(store.get(sleepCacheStaleAtom)).toBe(true);
    });
  });
});

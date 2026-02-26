import { createStore } from "jotai";
import {
  CALENDAR_CACHE_TTL_MS,
  calendarCacheStaleAtom,
  calendarLastSyncAtom,
} from "../../src/atoms/calendarAtoms";

describe("calendarAtoms", () => {
  describe("CALENDAR_CACHE_TTL_MS", () => {
    it("should be 5 minutes in milliseconds", () => {
      expect(CALENDAR_CACHE_TTL_MS).toBe(5 * 60 * 1000);
      expect(CALENDAR_CACHE_TTL_MS).toBe(300000);
    });
  });

  describe("calendarCacheStaleAtom", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-03-01T12:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return true when lastSync is null (initial state)", () => {
      const store = createStore();
      expect(store.get(calendarCacheStaleAtom)).toBe(true);
    });

    it("should return false when lastSync is within TTL", () => {
      const store = createStore();
      const oneMinuteAgo = Date.now() - 1 * 60 * 1000;
      store.set(calendarLastSyncAtom, oneMinuteAgo);
      expect(store.get(calendarCacheStaleAtom)).toBe(false);
    });

    it("should return true when lastSync exceeds TTL", () => {
      const store = createStore();
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      store.set(calendarLastSyncAtom, sixMinutesAgo);
      expect(store.get(calendarCacheStaleAtom)).toBe(true);
    });
  });

  describe("calendarSelectedDateAtom", () => {
    it("should default to start of today (00:00:00)", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-03-01T12:00:00Z"));

      let calendarSelectedDateAtom: ReturnType<
        (typeof import("jotai"))["atom"]
      >;
      jest.isolateModules(() => {
        ({
          calendarSelectedDateAtom,
        } = require("../../src/atoms/calendarAtoms"));
      });

      const store = createStore();
      const value = store.get(calendarSelectedDateAtom!);

      const expected = new Date("2026-03-01T12:00:00Z");
      expected.setHours(0, 0, 0, 0);

      expect(value).toBe(expected.getTime());

      jest.useRealTimers();
    });
  });
});

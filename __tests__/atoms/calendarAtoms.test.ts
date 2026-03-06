import AsyncStorage from "@react-native-async-storage/async-storage";
import { createStore } from "jotai";

import {
  CALENDAR_CACHE_TTL_MS,
  calendarCacheStaleAtom,
  calendarEventsAtom,
  calendarLastSyncAtom,
  calendarListAtom,
  calendarLoadingAtom,
  calendarSyncErrorAtom,
  calendarViewModeAtom,
  visibleCalendarEventsAtom,
} from "../../src/atoms/calendarAtoms";
import { settingsAtom } from "../../src/atoms/settingsAtoms";
import { STORAGE_KEYS } from "../../src/core/storage/keys";
import type { CalendarEvent } from "../../src/models/CalendarEvent";
import { DEFAULT_SETTINGS } from "../../src/models/Settings";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    sourceEventId: "source-evt-1",
    source: "google",
    title: "Test Event",
    description: "",
    startTimestampMs: 1700000000000,
    endTimestampMs: 1700003600000,
    allDay: false,
    colorId: null,
    calendarName: "Work",
    calendarId: "cal-1",
    ...overrides,
  };
}

describe("calendarAtoms", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("CALENDAR_CACHE_TTL_MS", () => {
    it("should be 5 minutes in milliseconds", () => {
      expect(CALENDAR_CACHE_TTL_MS).toBe(5 * 60 * 1000);
      expect(CALENDAR_CACHE_TTL_MS).toBe(300000);
    });
  });

  describe("persistence", () => {
    it("calendarEventsAtom should persist via AsyncStorage", () => {
      const store = createStore();
      const events = [makeEvent({ id: "evt-1" })];
      store.set(calendarEventsAtom, events);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.CALENDAR_CACHE,
        JSON.stringify(events),
      );
    });

    it("calendarLastSyncAtom should persist via AsyncStorage", () => {
      const store = createStore();
      const timestamp = 1700000000000;
      store.set(calendarLastSyncAtom, timestamp);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.CALENDAR_LAST_SYNC,
        JSON.stringify(timestamp),
      );
    });

    it("calendarViewModeAtom should persist via AsyncStorage", () => {
      const store = createStore();
      store.set(calendarViewModeAtom, "month");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.CALENDAR_VIEW_MODE,
        JSON.stringify("month"),
      );
    });

    it("calendarListAtom should persist via AsyncStorage", () => {
      const store = createStore();
      const calendars = [
        { id: "cal-1", name: "Work", color: "#ff0000", isPrimary: true },
      ];
      store.set(calendarListAtom, calendars);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.CALENDAR_LIST,
        JSON.stringify(calendars),
      );
    });
  });

  describe("volatile atoms", () => {
    it("calendarLoadingAtom should not persist", () => {
      const store = createStore();
      store.set(calendarLoadingAtom, true);

      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        expect.stringContaining("loading"),
        expect.anything(),
      );
    });

    it("calendarSyncErrorAtom should not persist", () => {
      const store = createStore();
      store.set(calendarSyncErrorAtom, "Network error");

      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        expect.stringContaining("error"),
        expect.anything(),
      );
    });

    it("calendarLoadingAtom should default to false", () => {
      const store = createStore();
      expect(store.get(calendarLoadingAtom)).toBe(false);
    });

    it("calendarSyncErrorAtom should default to null", () => {
      const store = createStore();
      expect(store.get(calendarSyncErrorAtom)).toBeNull();
    });
  });

  describe("default values", () => {
    it("calendarEventsAtom should default to empty array", () => {
      const store = createStore();
      store.set(calendarEventsAtom, []);
      expect(store.get(calendarEventsAtom)).toEqual([]);
    });

    it("calendarLastSyncAtom should default to null", () => {
      const store = createStore();
      store.set(calendarLastSyncAtom, null);
      expect(store.get(calendarLastSyncAtom)).toBeNull();
    });

    it("calendarViewModeAtom should default to agenda", () => {
      const store = createStore();
      store.set(calendarViewModeAtom, "agenda");
      expect(store.get(calendarViewModeAtom)).toBe("agenda");
    });

    it("calendarListAtom should default to empty array", () => {
      const store = createStore();
      store.set(calendarListAtom, []);
      expect(store.get(calendarListAtom)).toEqual([]);
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

  describe("visibleCalendarEventsAtom", () => {
    it("should return only events matching visibleCalendarIds", () => {
      const store = createStore();
      store.set(settingsAtom, {
        ...DEFAULT_SETTINGS,
        visibleCalendarIds: ["cal-1", "cal-3"],
      });
      store.set(calendarEventsAtom, [
        makeEvent({ id: "evt-1", calendarId: "cal-1" }),
        makeEvent({ id: "evt-2", calendarId: "cal-2" }),
        makeEvent({ id: "evt-3", calendarId: "cal-3" }),
      ]);

      const result = store.get(visibleCalendarEventsAtom);

      expect(result).toHaveLength(2);
      expect(result.map((e) => e.calendarId)).toEqual(["cal-1", "cal-3"]);
    });

    it("should return all events when visibleCalendarIds is empty", () => {
      const store = createStore();
      store.set(settingsAtom, {
        ...DEFAULT_SETTINGS,
        visibleCalendarIds: [],
      });
      store.set(calendarEventsAtom, [
        makeEvent({ id: "evt-1", calendarId: "cal-1" }),
        makeEvent({ id: "evt-2", calendarId: "cal-2" }),
      ]);

      const result = store.get(visibleCalendarEventsAtom);

      expect(result).toHaveLength(2);
    });

    it("should return empty array when no events exist", () => {
      const store = createStore();
      store.set(settingsAtom, {
        ...DEFAULT_SETTINGS,
        visibleCalendarIds: ["cal-1"],
      });
      store.set(calendarEventsAtom, []);

      const result = store.get(visibleCalendarEventsAtom);

      expect(result).toEqual([]);
    });

    it("should return empty array when no events match visibleCalendarIds", () => {
      const store = createStore();
      store.set(settingsAtom, {
        ...DEFAULT_SETTINGS,
        visibleCalendarIds: ["cal-99"],
      });
      store.set(calendarEventsAtom, [
        makeEvent({ id: "evt-1", calendarId: "cal-1" }),
        makeEvent({ id: "evt-2", calendarId: "cal-2" }),
      ]);

      const result = store.get(visibleCalendarEventsAtom);

      expect(result).toEqual([]);
    });

    it("should reactively update when visibleCalendarIds changes", () => {
      const store = createStore();
      store.set(calendarEventsAtom, [
        makeEvent({ id: "evt-1", calendarId: "cal-1" }),
        makeEvent({ id: "evt-2", calendarId: "cal-2" }),
      ]);

      store.set(settingsAtom, {
        ...DEFAULT_SETTINGS,
        visibleCalendarIds: ["cal-1"],
      });
      expect(store.get(visibleCalendarEventsAtom)).toHaveLength(1);

      store.set(settingsAtom, {
        ...DEFAULT_SETTINGS,
        visibleCalendarIds: [],
      });
      expect(store.get(visibleCalendarEventsAtom)).toHaveLength(2);
    });
  });
});

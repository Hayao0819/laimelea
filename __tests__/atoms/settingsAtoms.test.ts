import { createStore } from "jotai";
import {
  settingsAtom,
  cycleConfigAtom,
  setupCompleteAtom,
} from "../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../src/models/Settings";
import { DEFAULT_CYCLE_LENGTH_MINUTES } from "../../src/core/time/constants";

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

function createInitializedStore() {
  const store = createStore();
  // atomWithStorage + async storage needs explicit init for sync tests
  store.set(settingsAtom, DEFAULT_SETTINGS);
  return store;
}

describe("cycleConfigAtom", () => {
  it("should return default cycleConfig", () => {
    const store = createInitializedStore();
    const config = store.get(cycleConfigAtom);
    expect(config).toEqual({
      cycleLengthMinutes: DEFAULT_CYCLE_LENGTH_MINUTES,
      baseTimeMs: 0,
    });
  });

  it("should reflect settingsAtom updates", () => {
    const store = createInitializedStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      cycleConfig: { cycleLengthMinutes: 1440, baseTimeMs: 1000 },
    });
    const config = store.get(cycleConfigAtom);
    expect(config).toEqual({ cycleLengthMinutes: 1440, baseTimeMs: 1000 });
  });
});

describe("setupCompleteAtom", () => {
  it("should return false by default", () => {
    const store = createInitializedStore();
    const complete = store.get(setupCompleteAtom);
    expect(complete).toBe(false);
  });

  it("should reflect settingsAtom updates", () => {
    const store = createInitializedStore();
    store.set(settingsAtom, { ...DEFAULT_SETTINGS, setupComplete: true });
    const complete = store.get(setupCompleteAtom);
    expect(complete).toBe(true);
  });
});

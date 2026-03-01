import { createStore } from "jotai";
import {
  settingsAtom,
  settingsLoadedAtom,
  cycleConfigAtom,
  setupCompleteAtom,
  primaryTimeDisplayAtom,
  accountsAtom,
} from "../../src/atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../src/models/Settings";
import type { AppSettings } from "../../src/models/Settings";
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
});

describe("setupCompleteAtom", () => {
  it("should return false by default", () => {
    const store = createInitializedStore();
    const complete = store.get(setupCompleteAtom);
    expect(complete).toBe(false);
  });
});

describe("primaryTimeDisplayAtom", () => {
  it("should return 'custom' by default", () => {
    const store = createInitializedStore();
    const display = store.get(primaryTimeDisplayAtom);
    expect(display).toBe("custom");
  });

  it("should update settingsAtom.primaryTimeDisplay on write", () => {
    const store = createInitializedStore();
    store.set(primaryTimeDisplayAtom, "24h");
    const display = store.get(primaryTimeDisplayAtom);
    expect(display).toBe("24h");
    const settings = store.get(settingsAtom) as AppSettings;
    expect(settings.primaryTimeDisplay).toBe("24h");
  });

  it("should reflect settingsAtom updates", () => {
    const store = createInitializedStore();
    store.set(settingsAtom, {
      ...DEFAULT_SETTINGS,
      primaryTimeDisplay: "24h",
    });
    const display = store.get(primaryTimeDisplayAtom);
    expect(display).toBe("24h");
  });
});

describe("accountsAtom", () => {
  it("should return empty array by default", () => {
    const store = createInitializedStore();
    const accounts = store.get(accountsAtom);
    expect(accounts).toEqual([]);
  });

  it("should reflect accounts from settings", () => {
    const store = createInitializedStore();
    const testAccount = {
      email: "test@example.com",
      displayName: "Test User",
      photoUrl: null,
      provider: "app-auth" as const,
      addedAt: 1000,
    };
    store.set(settingsAtom, { ...DEFAULT_SETTINGS, accounts: [testAccount] });
    expect(store.get(accountsAtom)).toEqual([testAccount]);
  });
});

describe("settingsLoadedAtom", () => {
  it("should return true when settingsAtom is explicitly set", () => {
    const store = createInitializedStore();
    const loaded = store.get(settingsLoadedAtom);
    expect(loaded).toBe(true);
  });

  it("should return false when settingsAtom has not been explicitly set", () => {
    // A fresh store where settingsAtom has not been set via store.set().
    // atomWithStorage + getOnInit starts an async read from AsyncStorage,
    // so the unwrapped value is still the LOADING sentinel at this point.
    const store = createStore();
    const loaded = store.get(settingsLoadedAtom);
    expect(loaded).toBe(false);
  });

  it("should return true after settingsAtom is explicitly set on a store", () => {
    const store = createStore();
    store.set(settingsAtom, DEFAULT_SETTINGS);
    expect(store.get(settingsLoadedAtom)).toBe(true);
  });
});

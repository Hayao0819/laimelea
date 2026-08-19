import AsyncStorage from "@react-native-async-storage/async-storage";
import { createStore } from "jotai";

import { createPersistedAtom } from "../../../src/core/storage/persistedAtom";

const storage: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(storage[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      storage[key] = value;
      return Promise.resolve();
    }),
  },
}));

describe("createPersistedAtom", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(storage)) delete storage[key];
  });

  it("hydrates from storage once a subscriber mounts", async () => {
    storage["test-key"] = JSON.stringify(5);
    const { valueAtom, hydratedAtom } = createPersistedAtom<number>(
      "test-key",
      0,
    );
    const store = createStore();
    const unsubscribe = store.sub(valueAtom, () => {});

    for (let index = 0; index < 10; index++) {
      await Promise.resolve();
    }

    expect(store.get(hydratedAtom)).toBe(true);
    expect(store.get(valueAtom)).toBe(5);
    unsubscribe();
  });

  it("falls back to the initial value when the persisted JSON is corrupted", async () => {
    storage["corrupted-key"] = "not-json";
    const { valueAtom, hydratedAtom } = createPersistedAtom<number>(
      "corrupted-key",
      42,
    );
    const store = createStore();
    const unsubscribe = store.sub(valueAtom, () => {});

    for (let index = 0; index < 10; index++) {
      await Promise.resolve();
    }

    expect(store.get(hydratedAtom)).toBe(true);
    expect(store.get(valueAtom)).toBe(42);
    unsubscribe();
  });

  it("keeps a local write that lands before hydration resolves", async () => {
    let resolveGetItem: ((value: string | null) => void) | undefined;
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          resolveGetItem = resolve;
        }),
    );
    const { valueAtom, hydratedAtom } = createPersistedAtom<number>(
      "race-key",
      0,
    );
    const store = createStore();
    const unsubscribe = store.sub(valueAtom, () => {});

    store.set(valueAtom, 42);
    expect(store.get(valueAtom)).toBe(42);

    resolveGetItem?.(JSON.stringify(999));
    for (let index = 0; index < 10; index++) {
      await Promise.resolve();
    }

    expect(store.get(hydratedAtom)).toBe(true);
    expect(store.get(valueAtom)).toBe(42);
    unsubscribe();
  });

  it("chains two rapid functional updates issued before hydration resolves", async () => {
    storage["chain-key"] = JSON.stringify(10);
    const { valueAtom } = createPersistedAtom<number>("chain-key", 0);
    const store = createStore();

    const first = store.set(valueAtom, (previous: number) => previous + 1);
    const second = store.set(valueAtom, (previous: number) => previous + 100);
    await Promise.all([first, second]);

    expect(store.get(valueAtom)).toBe(111);
    expect(JSON.parse(storage["chain-key"])).toBe(111);
  });

  it("recovers from a setItem rejection without breaking subsequent writes", async () => {
    const { valueAtom } = createPersistedAtom<number>("reject-key", 0);
    const store = createStore();
    await store.set(valueAtom, 1);

    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error("disk full"),
    );
    await expect(store.set(valueAtom, 2)).rejects.toThrow("disk full");

    await store.set(valueAtom, 3);
    expect(store.get(valueAtom)).toBe(3);
    expect(JSON.parse(storage["reject-key"])).toBe(3);
  });

  it("resolves a functional update issued before any subscriber mounts against the persisted value", async () => {
    storage["functional-key"] = JSON.stringify(7);
    const { valueAtom } = createPersistedAtom<number>("functional-key", 0);
    const store = createStore();

    await store.set(valueAtom, (previous: number) => previous + 1);

    expect(store.get(valueAtom)).toBe(8);
    expect(JSON.parse(storage["functional-key"])).toBe(8);
  });

  it("does not write to storage when a functional update returns the same reference", async () => {
    storage["noop-key"] = JSON.stringify([1, 2, 3]);
    const { valueAtom } = createPersistedAtom<number[]>("noop-key", []);
    const store = createStore();

    await store.set(valueAtom, (previous: number[]) => previous);

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("applies normalize to the persisted value read by a pre-hydration functional update", async () => {
    storage["normalize-key"] = JSON.stringify({ legacy: 3 });
    const { valueAtom } = createPersistedAtom<number>(
      "normalize-key",
      0,
      (value) =>
        typeof value === "object" && value !== null && "legacy" in value
          ? (value as { legacy: number }).legacy
          : 0,
    );
    const store = createStore();

    await store.set(valueAtom, (previous: number) => previous + 1);

    expect(store.get(valueAtom)).toBe(4);
  });
});

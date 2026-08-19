import { atom } from "jotai";

import { createAsyncStorage } from "./asyncStorageAdapter";

interface PersistedValue<T> {
  value: T;
  hydrated: boolean;
  hasLocalWrite: boolean;
}

interface HydrationResult<T> {
  storedValue: T;
}

export function createPersistedAtom<T>(
  key: string,
  initialValue: T,
  normalize: (value: unknown) => T = (value) => value as T,
) {
  const storage = createAsyncStorage<T>();
  let writeQueue: Promise<void> = Promise.resolve();

  const stateAtom = atom<PersistedValue<T>>({
    value: initialValue,
    hydrated: false,
    hasLocalWrite: false,
  });

  // Not cached across calls: a store only hydrates once in practice (onMount
  // fires once per app lifetime), and caching here previously leaked a single
  // promise across the many independent stores each test creates.
  function fetchPersistedValue(): Promise<HydrationResult<T> | null> {
    return Promise.resolve(storage.getItem(key, initialValue))
      .then((storedValue) => ({ storedValue }))
      .catch(() => null);
  }

  stateAtom.onMount = (setState) => {
    let mounted = true;

    fetchPersistedValue().then((result) => {
      if (!mounted) return;
      setState((previous) => {
        if (previous.hydrated) return previous;
        return {
          ...previous,
          value:
            previous.hasLocalWrite || result === null
              ? previous.value
              : normalize(result.storedValue),
          hydrated: true,
        };
      });
    });

    return () => {
      mounted = false;
    };
  };

  const valueAtom = atom(
    (get) => get(stateAtom).value,
    (get, set, update: T | ((previous: T) => T)) => {
      const commit = (state: PersistedValue<T>): Promise<void> => {
        const nextValue =
          typeof update === "function"
            ? (update as (previous: T) => T)(state.value)
            : update;
        const unchanged = nextValue === state.value;

        set(stateAtom, {
          value: nextValue,
          hydrated: true,
          hasLocalWrite: unchanged ? state.hasLocalWrite : true,
        });

        if (unchanged) return Promise.resolve();

        const write = writeQueue.then(
          () => storage.setItem(key, nextValue),
          () => storage.setItem(key, nextValue),
        );
        writeQueue = write.then(
          () => undefined,
          () => undefined,
        );
        return write;
      };

      const current = get(stateAtom);
      if (current.hydrated || typeof update !== "function") {
        return commit(current);
      }

      // A functional update arriving before hydration must read the
      // persisted value as `previous`, not the in-memory default.
      return fetchPersistedValue().then((result) => {
        const latest = get(stateAtom);
        if (latest.hydrated) return commit(latest);
        return commit({
          ...latest,
          value:
            latest.hasLocalWrite || result === null
              ? latest.value
              : normalize(result.storedValue),
          hydrated: true,
        });
      });
    },
  );

  return {
    valueAtom,
    hydratedAtom: atom((get) => get(stateAtom).hydrated),
  };
}

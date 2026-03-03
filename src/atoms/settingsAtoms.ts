import { atom } from "jotai";
import { atomWithStorage, unwrap } from "jotai/utils";

import { createAsyncStorage } from "../core/storage/asyncStorageAdapter";
import { STORAGE_KEYS } from "../core/storage/keys";
import type { CycleConfig } from "../models/CustomTime";
import type { AppSettings } from "../models/Settings";
import { DEFAULT_ALARM_DEFAULTS, DEFAULT_SETTINGS } from "../models/Settings";

export const settingsAtom = atomWithStorage<AppSettings>(
  STORAGE_KEYS.SETTINGS,
  DEFAULT_SETTINGS,
  createAsyncStorage<AppSettings>(),
  { getOnInit: true },
);

// Sentinel value used to detect whether AsyncStorage has resolved yet.
const LOADING = Symbol("settings-loading");

// unwrap without a fallback returning the real value would give `undefined`,
// but we use a sentinel so we can distinguish "loading" from any real value.
const settingsOrLoadingAtom = unwrap(settingsAtom, () => LOADING as never);

/** true once settings have been loaded from AsyncStorage */
export const settingsLoadedAtom = atom<boolean>(
  (get) => get(settingsOrLoadingAtom) !== (LOADING as never),
);

// atomWithStorage + AsyncStorage keeps a Promise in the store until resolved.
// `unwrap` provides a synchronous view: returns the fallback while the Promise
// is pending, then switches to the resolved value once AsyncStorage responds.
const syncSettingsAtom = unwrap(
  settingsAtom,
  (prev) => prev ?? DEFAULT_SETTINGS,
);

// Derived atom that guarantees a complete AppSettings for use in components.
// Merges with DEFAULT_SETTINGS to fill any fields missing from persisted data
// (e.g. alarmDefaults may be absent if settings were saved before it existed).
export const resolvedSettingsAtom = atom<AppSettings>((get) => {
  const stored = get(syncSettingsAtom);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    alarmDefaults: { ...DEFAULT_ALARM_DEFAULTS, ...stored?.alarmDefaults },
  };
});

export const cycleConfigAtom = atom<CycleConfig>(
  (get) => get(resolvedSettingsAtom).cycleConfig,
);

export const setupCompleteAtom = atom<boolean>(
  (get) => get(resolvedSettingsAtom).setupComplete,
);

export const primaryTimeDisplayAtom = atom(
  (get) => get(resolvedSettingsAtom).primaryTimeDisplay,
  (get, set, value: "custom" | "24h") => {
    const current = get(resolvedSettingsAtom);
    set(settingsAtom, { ...current, primaryTimeDisplay: value });
  },
);

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { createAsyncStorage } from "../core/storage/asyncStorageAdapter";
import { STORAGE_KEYS } from "../core/storage/keys";
import { DEFAULT_SETTINGS } from "../models/Settings";
import type { AppSettings } from "../models/Settings";
import type { CycleConfig } from "../models/CustomTime";

export const settingsAtom = atomWithStorage<AppSettings>(
  STORAGE_KEYS.SETTINGS,
  DEFAULT_SETTINGS,
  createAsyncStorage<AppSettings>(),
  { getOnInit: true },
);

// atomWithStorage + AsyncStorage always types as `T | Promise<T>`,
// but `getOnInit: true` guarantees the value is resolved synchronously.

// Derived atom that guarantees a complete AppSettings for use in components.
// Merges with DEFAULT_SETTINGS to fill any fields missing from persisted data
// (e.g. alarmDefaults may be absent if settings were saved before it existed).
export const resolvedSettingsAtom = atom<AppSettings>((get) => {
  const stored = get(settingsAtom) as AppSettings;
  return { ...DEFAULT_SETTINGS, ...stored };
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

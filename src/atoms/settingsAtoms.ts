import { atom } from "jotai";
import { atomWithStorage, unwrap } from "jotai/utils";

import { createAsyncStorage } from "../core/storage/asyncStorageAdapter";
import { STORAGE_KEYS } from "../core/storage/keys";
import type { CycleConfig } from "../models/CustomTime";
import type { AppSettings } from "../models/Settings";
import {
  DEFAULT_ALARM_DEFAULTS,
  DEFAULT_SETTINGS,
  DEFAULT_WIDGET_SETTINGS,
} from "../models/Settings";

export const settingsAtom = atomWithStorage<AppSettings>(
  STORAGE_KEYS.SETTINGS,
  DEFAULT_SETTINGS,
  createAsyncStorage<AppSettings>(),
  { getOnInit: true },
);

const LOADING = Symbol("settings-loading");

const settingsOrLoadingAtom = unwrap(settingsAtom, () => LOADING as never);

export const settingsLoadedAtom = atom<boolean>(
  (get) => get(settingsOrLoadingAtom) !== (LOADING as never),
);

const syncSettingsAtom = unwrap(
  settingsAtom,
  (prev) => prev ?? DEFAULT_SETTINGS,
);

export const resolvedSettingsAtom = atom<AppSettings>((get) => {
  const stored = get(syncSettingsAtom);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    cycleConfig: {
      ...DEFAULT_SETTINGS.cycleConfig,
      ...stored?.cycleConfig,
    },
    alarmDefaults: { ...DEFAULT_ALARM_DEFAULTS, ...stored?.alarmDefaults },
    widgetSettings: {
      ...DEFAULT_WIDGET_SETTINGS,
      ...stored?.widgetSettings,
    },
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

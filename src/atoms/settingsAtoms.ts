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

export const cycleConfigAtom = atom<CycleConfig>(
  (get) => get(settingsAtom).cycleConfig,
);

export const setupCompleteAtom = atom<boolean>(
  (get) => get(settingsAtom).setupComplete,
);

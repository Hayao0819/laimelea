import { atomWithStorage } from "jotai/utils";
import { atom } from "jotai";
import { createAsyncStorage } from "../core/storage/asyncStorageAdapter";
import { STORAGE_KEYS } from "../core/storage/keys";
import type { SleepSession, CycleEstimation } from "../models/SleepSession";

export const sleepSessionsAtom = atomWithStorage<SleepSession[]>(
  STORAGE_KEYS.SLEEP_SESSIONS,
  [],
  createAsyncStorage<SleepSession[]>(),
  { getOnInit: true },
);

export const cycleEstimationAtom = atom<CycleEstimation | null>(null);

export const sleepLoadingAtom = atom(false);
export const sleepErrorAtom = atom<string | null>(null);
export const sleepLastSyncAtom = atom<number | null>(null);

export const SLEEP_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const sleepCacheStaleAtom = atom((get) => {
  const lastSync = get(sleepLastSyncAtom);
  if (lastSync == null) return true;
  return Date.now() - lastSync > SLEEP_CACHE_TTL_MS;
});

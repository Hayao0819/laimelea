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

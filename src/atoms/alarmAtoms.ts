import { atomWithStorage } from "jotai/utils";

import { normalizeAlarms } from "../core/storage/appState";
import { createAsyncStorage } from "../core/storage/asyncStorageAdapter";
import { STORAGE_KEYS } from "../core/storage/keys";
import type { Alarm } from "../models/Alarm";

export const alarmsAtom = atomWithStorage<Alarm[]>(
  STORAGE_KEYS.ALARMS,
  [],
  createAsyncStorage<Alarm[]>({
    reviver: (key, value) =>
      key === "" ? (normalizeAlarms(value) ?? []) : value,
  }),
  { getOnInit: true },
);

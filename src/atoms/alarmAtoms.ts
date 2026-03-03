import { atomWithStorage } from "jotai/utils";

import { createAsyncStorage } from "../core/storage/asyncStorageAdapter";
import { STORAGE_KEYS } from "../core/storage/keys";
import type { Alarm } from "../models/Alarm";

export const alarmsAtom = atomWithStorage<Alarm[]>(
  STORAGE_KEYS.ALARMS,
  [],
  createAsyncStorage<Alarm[]>(),
  { getOnInit: true },
);

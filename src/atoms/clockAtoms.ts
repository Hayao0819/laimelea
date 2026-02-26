import { atom } from "jotai";

export const currentTimeMsAtom = atom<number>(Date.now());

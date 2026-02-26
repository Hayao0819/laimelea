import { atom } from "jotai";
import { createPlatformServices } from "../core/platform/factory";
import type { PlatformType, PlatformServices } from "../core/platform/types";

export const platformTypeAtom = atom<PlatformType>("aosp");

export const platformServicesAtom = atom<PlatformServices>((get) => {
  return createPlatformServices(get(platformTypeAtom));
});

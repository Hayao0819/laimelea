import { NativeModules, Platform } from "react-native";

export interface ElapsedRealtimeSnapshot {
  elapsedRealtimeMs: number;
  bootCount: number;
}

interface ElapsedRealtimeModule {
  getElapsedRealtimeSnapshot(): Promise<unknown>;
}

function getModule(): Partial<ElapsedRealtimeModule> | undefined {
  if (Platform.OS !== "android") return undefined;
  return (NativeModules as { RingtoneModule?: Partial<ElapsedRealtimeModule> })
    .RingtoneModule;
}

export function hasElapsedRealtimeSnapshot(): boolean {
  return typeof getModule()?.getElapsedRealtimeSnapshot === "function";
}

function isSnapshot(value: unknown): value is ElapsedRealtimeSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.elapsedRealtimeMs === "number" &&
    Number.isFinite(candidate.elapsedRealtimeMs) &&
    candidate.elapsedRealtimeMs >= 0 &&
    typeof candidate.bootCount === "number" &&
    Number.isSafeInteger(candidate.bootCount) &&
    candidate.bootCount >= 0
  );
}

export async function readElapsedRealtimeSnapshot(): Promise<ElapsedRealtimeSnapshot | null> {
  const module = getModule();
  if (typeof module?.getElapsedRealtimeSnapshot !== "function") return null;

  try {
    const snapshot = await module.getElapsedRealtimeSnapshot();
    return isSnapshot(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

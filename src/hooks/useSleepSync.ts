import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef } from "react";

import { platformServicesAtom } from "../atoms/platformAtoms";
import {
  cycleEstimationAtom,
  sleepCacheStaleAtom,
  sleepErrorAtom,
  sleepLastSyncAtom,
  sleepLoadingAtom,
  sleepSessionsAtom,
} from "../atoms/sleepAtoms";
import { estimateCycle } from "../features/sleep/services/cycleDetector";
import type { SleepSession } from "../models/SleepSession";
import type { CycleEstimation } from "../models/SleepSession";

export interface SleepSyncResult {
  sessions: SleepSession[];
  estimation: CycleEstimation | null;
  loading: boolean;
  error: string | null;
  sync: (force?: boolean) => Promise<void>;
  recalculate: () => void;
  addManualEntry: (
    session: Omit<SleepSession, "id" | "source" | "createdAt" | "updatedAt">,
  ) => void;
  deleteEntry: (id: string) => void;
}

function generateId(): string {
  return `sleep-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sessionKey(session: SleepSession): string {
  return `${session.source}:${session.id}`;
}

function mergeSessions(
  currentSessions: SleepSession[],
  fetchedSessions: SleepSession[],
  manualSessionKeysAtStart: ReadonlySet<string>,
): SleepSession[] {
  const sessionsByKey = new Map<string, SleepSession>();

  for (const session of fetchedSessions) {
    if (
      session.source === "manual" &&
      manualSessionKeysAtStart.has(sessionKey(session)) &&
      !currentSessions.some(
        (current) => sessionKey(current) === sessionKey(session),
      )
    ) {
      continue;
    }
    sessionsByKey.set(sessionKey(session), session);
  }
  for (const session of currentSessions) {
    if (session.source !== "manual") continue;
    const key = sessionKey(session);
    const fetched = sessionsByKey.get(key);
    if (fetched == null || session.updatedAt >= fetched.updatedAt) {
      sessionsByKey.set(key, session);
    }
  }

  return [...sessionsByKey.values()].sort(
    (a, b) =>
      a.startTimestampMs - b.startTimestampMs ||
      a.endTimestampMs - b.endTimestampMs ||
      a.source.localeCompare(b.source) ||
      a.id.localeCompare(b.id),
  );
}

export function useSleepSync(): SleepSyncResult {
  const [sessions, setSessions] = useAtom(sleepSessionsAtom);
  const [loading, setLoading] = useAtom(sleepLoadingAtom);
  const [error, setError] = useAtom(sleepErrorAtom);
  const [estimation, setEstimation] = useAtom(cycleEstimationAtom);
  const setLastSync = useSetAtom(sleepLastSyncAtom);
  const isStale = useAtomValue(sleepCacheStaleAtom);
  const services = useAtomValue(platformServicesAtom);

  const syncingRef = useRef(false);

  const sync = useCallback(
    async (force = false) => {
      if (syncingRef.current) return;
      if (!force && !isStale) return;

      syncingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const manualSessionKeysAtStart = new Set(
          sessions
            .filter((session) => session.source === "manual")
            .map(sessionKey),
        );
        const available = await services.sleep.isAvailable();
        if (!available) {
          return;
        }

        const permitted = await services.sleep.requestPermissions();
        if (!permitted) {
          setError("Health Connect permission denied");
          return;
        }

        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        const fetched = await services.sleep.fetchSleepSessions(
          thirtyDaysAgo,
          now,
        );

        let merged: SleepSession[] = [];
        setSessions((current) => {
          merged = mergeSessions(
            Array.isArray(current) ? current : [],
            fetched,
            manualSessionKeysAtStart,
          );
          return merged;
        });
        setLastSync(now);

        const result = estimateCycle(merged);
        setEstimation(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
        syncingRef.current = false;
      }
    },
    [
      isStale,
      sessions,
      services.sleep,
      setSessions,
      setLastSync,
      setEstimation,
      setLoading,
      setError,
    ],
  );

  const recalculate = useCallback(() => {
    const result = estimateCycle(sessions);
    setEstimation(result);
  }, [sessions, setEstimation]);

  const addManualEntry = useCallback(
    (
      entry: Omit<SleepSession, "id" | "source" | "createdAt" | "updatedAt">,
    ) => {
      const now = Date.now();
      const session: SleepSession = {
        ...entry,
        id: generateId(),
        source: "manual",
        createdAt: now,
        updatedAt: now,
      };
      setSessions((prev) =>
        Array.isArray(prev) ? [...prev, session] : [session],
      );
    },
    [setSessions],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      setSessions((prev) =>
        Array.isArray(prev) ? prev.filter((s) => s.id !== id) : prev,
      );
    },
    [setSessions],
  );

  return {
    sessions,
    estimation,
    loading,
    error,
    sync,
    recalculate,
    addManualEntry,
    deleteEntry,
  };
}

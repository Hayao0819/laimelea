import { useCallback, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  sleepSessionsAtom,
  cycleEstimationAtom,
  sleepLoadingAtom,
  sleepErrorAtom,
  sleepLastSyncAtom,
  sleepCacheStaleAtom,
} from "../atoms/sleepAtoms";
import { platformServicesAtom } from "../atoms/platformAtoms";
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
        const available = await services.sleep.isAvailable();
        if (!available) {
          return;
        }

        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        const fetched = await services.sleep.fetchSleepSessions(
          thirtyDaysAgo,
          now,
        );

        const existingManual = sessions.filter(
          (s) => s.source === "manual",
        );

        const merged = [...existingManual, ...fetched];
        setSessions(merged);
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
      services.sleep,
      sessions,
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
      setSessions((prev) => [...prev, session]);
    },
    [setSessions],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
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

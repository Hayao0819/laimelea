import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";

import { alarmsAtom } from "../atoms/alarmAtoms";
import { settingsAtom } from "../atoms/settingsAtoms";
import { sleepSessionsAtom } from "../atoms/sleepAtoms";
import { game2048StoreAtom } from "../features/game2048/atoms/game2048Atoms";
import {
  recoverPendingBackupRestore,
  waitForRestoreWrites,
} from "../features/settings/services/restoreTransaction";

export function useRestoreRecovery(): boolean {
  const setSettings = useSetAtom(settingsAtom);
  const setAlarms = useSetAtom(alarmsAtom);
  const setSleepSessions = useSetAtom(sleepSessionsAtom);
  const setGame2048Store = useSetAtom(game2048StoreAtom);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const recover = async (): Promise<void> => {
      attempts += 1;
      try {
        await recoverPendingBackupRestore(async (snapshot) => {
          await waitForRestoreWrites([
            Promise.resolve(setSettings(snapshot.settings)),
            Promise.resolve(setAlarms(snapshot.alarms)),
            Promise.resolve(setSleepSessions(snapshot.sleepSessions)),
            Promise.resolve(setGame2048Store(snapshot.game2048)),
          ]);
        });
        if (!cancelled) setComplete(true);
      } catch {
        if (!cancelled && attempts < 3) {
          retryTimer = setTimeout(() => {
            recover().catch(() => undefined);
          }, attempts * 1_000);
        } else if (!cancelled) {
          setComplete(true);
        }
      }
    };
    recover().catch(() => undefined);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [setAlarms, setGame2048Store, setSettings, setSleepSessions]);

  return complete;
}

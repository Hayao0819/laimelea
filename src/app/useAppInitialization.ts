import { useSetAtom } from "jotai";
import { useEffect } from "react";

import { platformTypeAtom } from "../atoms/platformAtoms";
import {
  createAlarmChannel,
  createTimerChannel,
  ensureNotificationPermissions,
} from "../core/notifications/notifeeSetup";
import { detectPlatform } from "../core/platform/detection";

export function useAppInitialization(): void {
  const setPlatformType = useSetAtom(platformTypeAtom);

  useEffect(() => {
    Promise.allSettled([
      createAlarmChannel(),
      createTimerChannel(),
      ensureNotificationPermissions(),
    ]).catch(() => undefined);
    detectPlatform()
      .then(setPlatformType)
      .catch(() => undefined);
  }, [setPlatformType]);
}

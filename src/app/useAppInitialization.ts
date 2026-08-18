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
    createAlarmChannel();
    createTimerChannel();
    ensureNotificationPermissions();
    detectPlatform().then(setPlatformType);
  }, [setPlatformType]);
}

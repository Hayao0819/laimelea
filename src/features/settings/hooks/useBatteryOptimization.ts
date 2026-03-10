import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import {
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
} from "../../../core/platform/batteryOptimization";

export type BatteryOptimizationStatus = boolean | null;

export function useBatteryOptimization() {
  const [ignored, setIgnored] = useState<BatteryOptimizationStatus>(null);

  const checkStatus = useCallback(async () => {
    const result = await isIgnoringBatteryOptimizations();
    setIgnored(result);
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkStatus();
      }
    });
    return () => subscription.remove();
  }, [checkStatus]);

  const requestExclusion = useCallback(async () => {
    await requestIgnoreBatteryOptimizations();
    await checkStatus();
  }, [checkStatus]);

  return { ignored, requestExclusion };
}

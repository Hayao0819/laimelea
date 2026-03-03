import { useAtom, useAtomValue } from "jotai";
import { useEffect } from "react";

import { currentTimeMsAtom } from "../atoms/clockAtoms";
import { settingsAtom } from "../atoms/settingsAtoms";
import { realToCustom } from "../core/time/conversions";
import type { CustomTimeValue } from "../models/CustomTime";

export interface CurrentTimeResult {
  realTimeMs: number;
  customTime: CustomTimeValue;
  cycleLengthMinutes: number;
}

export function useCurrentTime(): CurrentTimeResult {
  const [realTimeMs, setRealTimeMs] = useAtom(currentTimeMsAtom);
  const settings = useAtomValue(settingsAtom);

  useEffect(() => {
    const id = setInterval(() => {
      setRealTimeMs(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [setRealTimeMs]);

  const customTime = realToCustom(realTimeMs, settings.cycleConfig);

  return {
    realTimeMs,
    customTime,
    cycleLengthMinutes: settings.cycleConfig.cycleLengthMinutes,
  };
}

import { NativeModules } from "react-native";

interface BatteryOptimizationModuleSpec {
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  requestIgnoreBatteryOptimizations(): Promise<boolean>;
}

function getModule(): BatteryOptimizationModuleSpec | undefined {
  return NativeModules.BatteryOptimizationModule as
    | BatteryOptimizationModuleSpec
    | undefined;
}

export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  try {
    const mod = getModule();
    if (!mod) {
      return true;
    }
    return await mod.isIgnoringBatteryOptimizations();
  } catch {
    return false;
  }
}

export async function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  try {
    const mod = getModule();
    if (!mod) {
      return true;
    }
    return await mod.requestIgnoreBatteryOptimizations();
  } catch {
    return false;
  }
}

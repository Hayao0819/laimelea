import { NativeModules } from "react-native";

interface BatteryOptimizationModuleSpec {
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  openBatteryOptimizationSettings(): Promise<boolean>;
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

export async function openBatteryOptimizationSettings(): Promise<boolean> {
  try {
    const mod = getModule();
    if (!mod) {
      return false;
    }
    return await mod.openBatteryOptimizationSettings();
  } catch {
    return false;
  }
}

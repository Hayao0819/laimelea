import { GoogleSignin } from "@react-native-google-signin/google-signin";

import NativeDeviceInfoModule from "./native/NativeDeviceInfoModule";
import type { PlatformType } from "./types";

export function getDeviceManufacturer(): string | null {
  return NativeDeviceInfoModule?.getManufacturer() ?? null;
}

export async function detectPlatform(): Promise<PlatformType> {
  try {
    const available = await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: false,
    });
    if (available) {
      return "gms";
    }
  } catch {
    // Play Services not available
  }

  // GMS not available — check if Huawei device
  try {
    const manufacturer = getDeviceManufacturer();
    if (manufacturer?.toLowerCase() === "huawei") {
      return "hms";
    }
  } catch {
    // DeviceInfo module not available
  }

  return "aosp";
}

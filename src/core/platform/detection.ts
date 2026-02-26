import { GoogleSignin } from "@react-native-google-signin/google-signin";
import type { PlatformType } from "./types";

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
  return "aosp";
}

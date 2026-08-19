import type { PlatformAuthService } from "../types";

export function createAospAuthService(): PlatformAuthService {
  return {
    isAvailable: async () => false,
    signIn: async () => {
      throw new Error("Cloud authentication is unavailable on AOSP devices");
    },
    signOut: async () => undefined,
    getAccessToken: async () => null,
  };
}

import type { PlatformAuthService } from "../types";

export function createAospAuthService(): PlatformAuthService {
  return {
    async isAvailable() {
      return false;
    },

    async signIn() {
      throw new Error("AOSP auth requires react-native-app-auth configuration");
    },

    async signOut() {
      throw new Error("AOSP auth requires react-native-app-auth configuration");
    },

    async getAccessToken() {
      return null;
    },
  };
}

import { GoogleSignin } from "@react-native-google-signin/google-signin";
import type { PlatformAuthService } from "../types";

export function createGmsAuthService(): PlatformAuthService {
  return {
    async isAvailable() {
      try {
        return await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: false,
        });
      } catch {
        return false;
      }
    },

    async signIn() {
      const response = await GoogleSignin.signIn();
      if (response.type !== "success") {
        throw new Error("Google sign-in was cancelled");
      }
      const tokens = await GoogleSignin.getTokens();
      return {
        email: response.data.user.email,
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
      };
    },

    async signOut() {
      await GoogleSignin.signOut();
    },

    async getAccessToken() {
      try {
        const tokens = await GoogleSignin.getTokens();
        return tokens.accessToken;
      } catch {
        return null;
      }
    },
  };
}

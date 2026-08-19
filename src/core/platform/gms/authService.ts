import { GoogleSignin } from "@react-native-google-signin/google-signin";

import type { PlatformAuthService } from "../types";
import { GMS_AUTH_CONFIG, isGmsAuthConfigured } from "./authConfig";

function createUnavailableGmsAuthService(): PlatformAuthService {
  const unavailable = () =>
    Promise.reject(
      new Error(
        "Google backup is unavailable because its web client ID is not configured",
      ),
    );

  return {
    isAvailable: async () => false,
    signIn: unavailable,
    signOut: async () => undefined,
    getAccessToken: async () => null,
  };
}

export function createGmsAuthService(): PlatformAuthService {
  if (!isGmsAuthConfigured()) {
    return createUnavailableGmsAuthService();
  }

  try {
    GoogleSignin.configure(GMS_AUTH_CONFIG);
  } catch {
    return createUnavailableGmsAuthService();
  }

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

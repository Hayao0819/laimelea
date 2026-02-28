import AsyncStorage from "@react-native-async-storage/async-storage";
import { authorize, refresh, revoke } from "react-native-app-auth";

import { STORAGE_KEYS } from "../../storage/keys";
import type { AuthResult, PlatformAuthService } from "../types";
import { extractEmailFromIdToken } from "../aosp/tokenUtils";
import { HMS_AUTH_CONFIG } from "./authConfig";

interface StoredAuthState {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  email: string;
  expirationDate: string;
}

async function loadAuthState(): Promise<StoredAuthState | null> {
  const json = await AsyncStorage.getItem(STORAGE_KEYS.HMS_AUTH_STATE);
  if (!json) {
    return null;
  }
  return JSON.parse(json) as StoredAuthState;
}

async function saveAuthState(state: StoredAuthState): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.HMS_AUTH_STATE,
    JSON.stringify(state),
  );
}

async function clearAuthState(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.HMS_AUTH_STATE);
}

export function createHmsAuthService(): PlatformAuthService {
  return {
    async isAvailable() {
      return true;
    },

    async signIn(): Promise<AuthResult> {
      const result = await authorize(HMS_AUTH_CONFIG);

      const email = result.idToken
        ? extractEmailFromIdToken(result.idToken)
        : "";

      await saveAuthState({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        idToken: result.idToken,
        email,
        expirationDate: result.accessTokenExpirationDate,
      });

      return {
        email,
        accessToken: result.accessToken,
        idToken: result.idToken || undefined,
      };
    },

    async signOut(): Promise<void> {
      const state = await loadAuthState();
      if (state?.refreshToken) {
        try {
          await revoke(HMS_AUTH_CONFIG, {
            tokenToRevoke: state.refreshToken,
          });
        } catch {
          // Revocation failure should not block sign-out
        }
      }
      await clearAuthState();
    },

    async getAccessToken(): Promise<string | null> {
      const state = await loadAuthState();
      if (!state) {
        return null;
      }

      const isExpired = new Date(state.expirationDate).getTime() <= Date.now();
      if (!isExpired) {
        return state.accessToken;
      }

      // Token expired — attempt refresh
      try {
        const result = await refresh(HMS_AUTH_CONFIG, {
          refreshToken: state.refreshToken,
        });

        const updatedState: StoredAuthState = {
          ...state,
          accessToken: result.accessToken,
          expirationDate: result.accessTokenExpirationDate,
          refreshToken: result.refreshToken || state.refreshToken,
          idToken: result.idToken || state.idToken,
        };
        await saveAuthState(updatedState);

        return result.accessToken;
      } catch {
        // Refresh failed — user needs to sign in again
        return null;
      }
    },
  };
}

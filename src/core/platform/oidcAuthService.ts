import type { AuthConfiguration } from "react-native-app-auth";
import { authorize, refresh, revoke } from "react-native-app-auth";

import {
  getSecureItem,
  removeSecureItem,
  setSecureItem,
} from "../storage/secureStorage";
import type { AuthResult, PlatformAuthService } from "./types";

interface StoredAuthState {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  email: string;
  expirationDate: string;
}

interface OidcAuthServiceOptions {
  authConfig: AuthConfiguration;
  secureStorageService: string;
  legacyStorageKey: string;
  extractEmail(idToken: string): string;
}

function isStoredAuthState(value: unknown): value is StoredAuthState {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const state = value as Record<string, unknown>;
  return (
    typeof state.accessToken === "string" &&
    state.accessToken.length > 0 &&
    typeof state.refreshToken === "string" &&
    state.refreshToken.length > 0 &&
    typeof state.idToken === "string" &&
    typeof state.email === "string" &&
    typeof state.expirationDate === "string" &&
    Number.isFinite(Date.parse(state.expirationDate))
  );
}

export function createOidcAuthService({
  authConfig,
  secureStorageService,
  legacyStorageKey,
  extractEmail,
}: OidcAuthServiceOptions): PlatformAuthService {
  const loadAuthState = async (): Promise<StoredAuthState | null> => {
    const json = await getSecureItem(secureStorageService, legacyStorageKey);
    if (!json) {
      return null;
    }
    try {
      const state: unknown = JSON.parse(json);
      if (isStoredAuthState(state)) {
        return state;
      }
    } catch {}
    await clearAuthState();
    return null;
  };

  const saveAuthState = async (state: StoredAuthState): Promise<void> => {
    await setSecureItem(
      secureStorageService,
      JSON.stringify(state),
      legacyStorageKey,
    );
  };

  const clearAuthState = async (): Promise<void> => {
    await removeSecureItem(secureStorageService, legacyStorageKey);
  };

  return {
    async isAvailable() {
      return true;
    },

    async signIn(): Promise<AuthResult> {
      const result = await authorize(authConfig);
      const email = result.idToken ? extractEmail(result.idToken) : "";

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
          await revoke(authConfig, { tokenToRevoke: state.refreshToken });
        } catch {}
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

      try {
        const result = await refresh(authConfig, {
          refreshToken: state.refreshToken,
        });
        await saveAuthState({
          ...state,
          accessToken: result.accessToken,
          expirationDate: result.accessTokenExpirationDate,
          refreshToken: result.refreshToken || state.refreshToken,
          idToken: result.idToken || state.idToken,
        });

        return result.accessToken;
      } catch {
        return null;
      }
    },
  };
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { authorize, refresh, revoke } from "react-native-app-auth";

import { STORAGE_KEYS } from "../storage/keys";
import { decodeIdTokenPayload } from "../platform/aosp/tokenUtils";
import { GOOGLE_AUTH_CONFIG } from "./authConfig";
import type { Account, AccountManager, StoredAccountAuthState } from "./types";

type AuthStateRecord = Record<string, StoredAccountAuthState>;

async function loadAllAuthStates(): Promise<AuthStateRecord> {
  const json = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNT_AUTH_STATES);
  if (!json) {
    return {};
  }
  return JSON.parse(json) as AuthStateRecord;
}

async function saveAllAuthStates(states: AuthStateRecord): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.ACCOUNT_AUTH_STATES,
    JSON.stringify(states),
  );
}

function extractAccountFromIdToken(idToken: string): {
  email: string;
  displayName: string;
  photoUrl: string | null;
} {
  const payload = decodeIdTokenPayload(idToken);

  const email = typeof payload.email === "string" ? payload.email : "";
  const displayName = typeof payload.name === "string" ? payload.name : email;
  const photoUrl = typeof payload.picture === "string" ? payload.picture : null;

  return { email, displayName, photoUrl };
}

export function createAccountManager(): AccountManager {
  return {
    async getAccounts(): Promise<Account[]> {
      const states = await loadAllAuthStates();
      return Object.values(states).map((state) => ({
        email: state.email,
        displayName: state.email,
        photoUrl: null,
        provider: "app-auth" as const,
        addedAt: 0,
      }));
    },

    async addAccount(): Promise<Account> {
      const result = await authorize(GOOGLE_AUTH_CONFIG);

      const { email, displayName, photoUrl } = result.idToken
        ? extractAccountFromIdToken(result.idToken)
        : { email: "", displayName: "", photoUrl: null };

      const now = Date.now();

      const states = await loadAllAuthStates();
      states[email] = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        idToken: result.idToken,
        email,
        expirationDate: result.accessTokenExpirationDate,
      };
      await saveAllAuthStates(states);

      return {
        email,
        displayName,
        photoUrl,
        provider: "app-auth",
        addedAt: now,
      };
    },

    async removeAccount(email: string): Promise<void> {
      const states = await loadAllAuthStates();
      const state = states[email];

      if (state?.refreshToken) {
        try {
          await revoke(GOOGLE_AUTH_CONFIG, {
            tokenToRevoke: state.refreshToken,
          });
        } catch {
          // Revocation failure should not block removal
        }
      }

      delete states[email];
      await saveAllAuthStates(states);
    },

    async getAccessToken(email: string): Promise<string | null> {
      const states = await loadAllAuthStates();
      const state = states[email];
      if (!state) {
        return null;
      }

      const isExpired = new Date(state.expirationDate).getTime() <= Date.now();
      if (!isExpired) {
        return state.accessToken;
      }

      try {
        const result = await refresh(GOOGLE_AUTH_CONFIG, {
          refreshToken: state.refreshToken,
        });

        states[email] = {
          ...state,
          accessToken: result.accessToken,
          expirationDate: result.accessTokenExpirationDate,
          refreshToken: result.refreshToken || state.refreshToken,
          idToken: result.idToken || state.idToken,
        };
        await saveAllAuthStates(states);

        return result.accessToken;
      } catch {
        return null;
      }
    },

    async getAllAccessTokens(): Promise<Map<string, string>> {
      const states = await loadAllAuthStates();
      const tokens = new Map<string, string>();

      for (const email of Object.keys(states)) {
        const token = await this.getAccessToken(email);
        if (token) {
          tokens.set(email, token);
        }
      }

      return tokens;
    },
  };
}

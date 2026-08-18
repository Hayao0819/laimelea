import { SECURE_STORAGE_SERVICES, STORAGE_KEYS } from "../../storage/keys";
import { extractEmailFromIdToken } from "../aosp/tokenUtils";
import { createOidcAuthService } from "../oidcAuthService";
import type { PlatformAuthService } from "../types";
import { HMS_AUTH_CONFIG, isHmsAuthConfigured } from "./authConfig";

function createUnavailableHmsAuthService(): PlatformAuthService {
  const unavailable = () =>
    Promise.reject(
      new Error(
        "Huawei backup is unavailable because its OAuth client ID is not configured",
      ),
    );

  return {
    isAvailable: async () => false,
    signIn: unavailable,
    signOut: async () => undefined,
    getAccessToken: async () => null,
  };
}

export function createHmsAuthService() {
  if (!isHmsAuthConfigured()) {
    return createUnavailableHmsAuthService();
  }

  return createOidcAuthService({
    authConfig: HMS_AUTH_CONFIG,
    secureStorageService: SECURE_STORAGE_SERVICES.HMS_AUTH_STATE,
    legacyStorageKey: STORAGE_KEYS.HMS_AUTH_STATE,
    extractEmail: extractEmailFromIdToken,
  });
}

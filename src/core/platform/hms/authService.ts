import { SECURE_STORAGE_SERVICES, STORAGE_KEYS } from "../../storage/keys";
import { extractEmailFromIdToken } from "../aosp/tokenUtils";
import { createOidcAuthService } from "../oidcAuthService";
import { HMS_AUTH_CONFIG } from "./authConfig";

export function createHmsAuthService() {
  return createOidcAuthService({
    authConfig: HMS_AUTH_CONFIG,
    secureStorageService: SECURE_STORAGE_SERVICES.HMS_AUTH_STATE,
    legacyStorageKey: STORAGE_KEYS.HMS_AUTH_STATE,
    extractEmail: extractEmailFromIdToken,
  });
}

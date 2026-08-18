import { SECURE_STORAGE_SERVICES, STORAGE_KEYS } from "../../storage/keys";
import { createOidcAuthService } from "../oidcAuthService";
import { AOSP_AUTH_CONFIG } from "./authConfig";
import { extractEmailFromIdToken } from "./tokenUtils";

export function createAospAuthService() {
  return createOidcAuthService({
    authConfig: AOSP_AUTH_CONFIG,
    secureStorageService: SECURE_STORAGE_SERVICES.AOSP_AUTH_STATE,
    legacyStorageKey: STORAGE_KEYS.AOSP_AUTH_STATE,
    extractEmail: extractEmailFromIdToken,
  });
}

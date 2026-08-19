import Config from "react-native-config";

export function isGmsAuthConfigured(): boolean {
  return Boolean(Config.GOOGLE_WEB_CLIENT_ID?.trim());
}

export const GMS_AUTH_CONFIG = {
  webClientId: Config.GOOGLE_WEB_CLIENT_ID ?? "",
  scopes: ["https://www.googleapis.com/auth/drive.appdata"],
  offlineAccess: false,
};

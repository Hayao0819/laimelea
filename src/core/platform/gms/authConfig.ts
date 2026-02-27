import Config from "react-native-config";

export const GMS_AUTH_CONFIG = {
  webClientId: Config.GOOGLE_WEB_CLIENT_ID ?? "",
  scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  offlineAccess: true,
};

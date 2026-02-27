import type { AuthConfiguration } from "react-native-app-auth";
import Config from "react-native-config";

export const AOSP_AUTH_CONFIG: AuthConfiguration = {
  issuer: "https://accounts.google.com",
  clientId: Config.GOOGLE_OAUTH_CLIENT_ID ?? "",
  redirectUrl: "com.hayao0819.laimelea://oauth/callback",
  scopes: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.readonly",
  ],
  usePKCE: true,
  androidAllowCustomBrowsers: ["chromeCustomTab"],
};

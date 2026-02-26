import type { AuthConfiguration } from "react-native-app-auth";

export const AOSP_AUTH_CONFIG: AuthConfiguration = {
  issuer: "https://accounts.google.com",
  clientId: "__GOOGLE_OAUTH_CLIENT_ID__",
  redirectUrl: "com.hayao0819.laimelea://oauth/callback",
  scopes: ["openid", "email", "profile"],
  usePKCE: true,
  androidAllowCustomBrowsers: ["chromeCustomTab"],
};

import type { AuthConfiguration } from "react-native-app-auth";
import Config from "react-native-config";

function reverseClientIdRedirectUrl(clientId: string): string {
  const guid = clientId.replace(".apps.googleusercontent.com", "");
  return `com.googleusercontent.apps.${guid}:/oauth2redirect/google`;
}

const clientId = Config.GOOGLE_OAUTH_CLIENT_ID ?? "";

export const AOSP_AUTH_CONFIG: AuthConfiguration = {
  issuer: "https://accounts.google.com",
  clientId,
  redirectUrl: reverseClientIdRedirectUrl(clientId),
  scopes: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.appdata",
  ],
  usePKCE: true,
  androidAllowCustomBrowsers: ["chromeCustomTab"],
};

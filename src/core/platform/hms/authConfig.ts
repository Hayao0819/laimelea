import type { AuthConfiguration } from "react-native-app-auth";
import Config from "react-native-config";

export const HMS_REDIRECT_SCHEME = "com.hayao0819.laimelea";

export function isHmsAuthConfigured(): boolean {
  return Boolean(Config.HUAWEI_OAUTH_APP_ID?.trim());
}

export const HMS_AUTH_CONFIG: AuthConfiguration = {
  serviceConfiguration: {
    authorizationEndpoint:
      "https://oauth-login.cloud.huawei.com/oauth2/v3/authorize",
    tokenEndpoint: "https://oauth-login.cloud.huawei.com/oauth2/v3/token",
  },
  clientId: Config.HUAWEI_OAUTH_APP_ID ?? "",
  redirectUrl: `${HMS_REDIRECT_SCHEME}://oauth/callback`,
  scopes: [
    "openid",
    "email",
    "profile",
    "https://www.huawei.com/auth/drive.appdata",
  ],
  usePKCE: true,
  androidAllowCustomBrowsers: ["chromeCustomTab"],
};

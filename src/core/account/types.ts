export interface Account {
  email: string;
  displayName: string;
  photoUrl: string | null;
  provider: "app-auth";
  addedAt: number; // Unix ms
}

export interface StoredAccountAuthState {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  email: string;
  expirationDate: string; // ISO date string
}

export interface AccountManager {
  getAccounts(): Promise<Account[]>;
  addAccount(): Promise<Account>;
  removeAccount(email: string): Promise<void>;
  getAccessToken(email: string): Promise<string | null>;
  getAllAccessTokens(): Promise<Map<string, string>>;
}

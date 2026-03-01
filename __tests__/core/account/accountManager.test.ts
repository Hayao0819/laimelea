import { createAccountManager } from "../../../src/core/account/accountManager";
import { STORAGE_KEYS } from "../../../src/core/storage/keys";
import type { StoredAccountAuthState } from "../../../src/core/account/types";

const mockStore: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStore[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStore[key];
      return Promise.resolve();
    }),
  },
}));

const mockAuthorize = jest.fn();
const mockRefresh = jest.fn();
const mockRevoke = jest.fn();

jest.mock("react-native-app-auth", () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  refresh: (...args: unknown[]) => mockRefresh(...args),
  revoke: (...args: unknown[]) => mockRevoke(...args),
}));

const mockDecodeIdTokenPayload = jest.fn();

jest.mock("../../../src/core/platform/aosp/tokenUtils", () => ({
  decodeIdTokenPayload: (...args: unknown[]) =>
    mockDecodeIdTokenPayload(...args),
}));

function clearMockStore(): void {
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key];
  }
}

function setStoredAuthStates(
  states: Record<string, StoredAccountAuthState>,
): void {
  mockStore[STORAGE_KEYS.ACCOUNT_AUTH_STATES] = JSON.stringify(states);
}

function getStoredAuthStates(): Record<string, StoredAccountAuthState> {
  const json = mockStore[STORAGE_KEYS.ACCOUNT_AUTH_STATES];
  if (!json) {
    return {};
  }
  return JSON.parse(json) as Record<string, StoredAccountAuthState>;
}

describe("createAccountManager", () => {
  beforeEach(() => {
    clearMockStore();
    jest.clearAllMocks();
  });

  describe("addAccount", () => {
    it("should authorize and return an Account on success", async () => {
      mockAuthorize.mockResolvedValue({
        accessToken: "at-123",
        refreshToken: "rt-456",
        idToken: "id-token-789",
        accessTokenExpirationDate: "2099-01-01T00:00:00Z",
      });
      mockDecodeIdTokenPayload.mockReturnValue({
        email: "user@example.com",
        name: "Test User",
        picture: "https://example.com/photo.jpg",
      });

      const manager = createAccountManager();
      const account = await manager.addAccount();

      expect(mockAuthorize).toHaveBeenCalledTimes(1);
      expect(account.email).toBe("user@example.com");
      expect(account.displayName).toBe("Test User");
      expect(account.photoUrl).toBe("https://example.com/photo.jpg");
      expect(account.provider).toBe("app-auth");
      expect(account.addedAt).toBeGreaterThan(0);

      const stored = getStoredAuthStates();
      expect(stored["user@example.com"]).toEqual({
        accessToken: "at-123",
        refreshToken: "rt-456",
        idToken: "id-token-789",
        email: "user@example.com",
        expirationDate: "2099-01-01T00:00:00Z",
      });
    });

    it("should overwrite existing account when re-added", async () => {
      setStoredAuthStates({
        "user@example.com": {
          accessToken: "old-at",
          refreshToken: "old-rt",
          idToken: "old-it",
          email: "user@example.com",
          expirationDate: "2020-01-01T00:00:00Z",
        },
      });

      mockAuthorize.mockResolvedValue({
        accessToken: "new-at",
        refreshToken: "new-rt",
        idToken: "new-it",
        accessTokenExpirationDate: "2099-06-01T00:00:00Z",
      });
      mockDecodeIdTokenPayload.mockReturnValue({
        email: "user@example.com",
        name: "Updated Name",
        picture: null,
      });

      const manager = createAccountManager();
      const account = await manager.addAccount();

      expect(account.email).toBe("user@example.com");
      expect(account.displayName).toBe("Updated Name");
      expect(account.photoUrl).toBeNull();

      const stored = getStoredAuthStates();
      expect(stored["user@example.com"].accessToken).toBe("new-at");
      expect(stored["user@example.com"].refreshToken).toBe("new-rt");
    });

    it("should handle missing idToken gracefully", async () => {
      mockAuthorize.mockResolvedValue({
        accessToken: "at",
        refreshToken: "rt",
        idToken: "",
        accessTokenExpirationDate: "2099-01-01T00:00:00Z",
      });

      const manager = createAccountManager();
      const account = await manager.addAccount();

      expect(mockDecodeIdTokenPayload).not.toHaveBeenCalled();
      expect(account.email).toBe("");
      expect(account.displayName).toBe("");
    });

    it("should propagate authorize errors", async () => {
      mockAuthorize.mockRejectedValue(new Error("User cancelled"));

      const manager = createAccountManager();
      await expect(manager.addAccount()).rejects.toThrow("User cancelled");
    });
  });

  describe("getAccounts", () => {
    it("should return accounts from stored auth states", async () => {
      setStoredAuthStates({
        "alice@example.com": {
          accessToken: "at-a",
          refreshToken: "rt-a",
          idToken: "it-a",
          email: "alice@example.com",
          expirationDate: "2099-01-01T00:00:00Z",
        },
        "bob@example.com": {
          accessToken: "at-b",
          refreshToken: "rt-b",
          idToken: "it-b",
          email: "bob@example.com",
          expirationDate: "2099-01-01T00:00:00Z",
        },
      });

      const manager = createAccountManager();
      const accounts = await manager.getAccounts();

      expect(accounts).toHaveLength(2);
      expect(accounts.map((a) => a.email).sort()).toEqual([
        "alice@example.com",
        "bob@example.com",
      ]);
      expect(accounts[0].provider).toBe("app-auth");
    });

    it("should return empty array when no stored state", async () => {
      const manager = createAccountManager();
      const accounts = await manager.getAccounts();

      expect(accounts).toEqual([]);
    });
  });

  describe("getAccessToken", () => {
    it("should return valid token when not expired", async () => {
      setStoredAuthStates({
        "user@example.com": {
          accessToken: "valid-token",
          refreshToken: "rt",
          idToken: "it",
          email: "user@example.com",
          expirationDate: "2099-01-01T00:00:00Z",
        },
      });

      const manager = createAccountManager();
      const token = await manager.getAccessToken("user@example.com");

      expect(token).toBe("valid-token");
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("should refresh expired token and return new token", async () => {
      setStoredAuthStates({
        "user@example.com": {
          accessToken: "expired-token",
          refreshToken: "rt",
          idToken: "it",
          email: "user@example.com",
          expirationDate: "2000-01-01T00:00:00Z",
        },
      });
      mockRefresh.mockResolvedValue({
        accessToken: "new-token",
        refreshToken: "new-rt",
        idToken: "new-it",
        accessTokenExpirationDate: "2099-01-01T00:00:00Z",
      });

      const manager = createAccountManager();
      const token = await manager.getAccessToken("user@example.com");

      expect(token).toBe("new-token");
      expect(mockRefresh).toHaveBeenCalledTimes(1);

      const stored = getStoredAuthStates();
      expect(stored["user@example.com"].accessToken).toBe("new-token");
      expect(stored["user@example.com"].refreshToken).toBe("new-rt");
    });

    it("should return null when refresh fails", async () => {
      setStoredAuthStates({
        "user@example.com": {
          accessToken: "expired-token",
          refreshToken: "rt",
          idToken: "it",
          email: "user@example.com",
          expirationDate: "2000-01-01T00:00:00Z",
        },
      });
      mockRefresh.mockRejectedValue(new Error("Refresh failed"));

      const manager = createAccountManager();
      const token = await manager.getAccessToken("user@example.com");

      expect(token).toBeNull();
    });

    it("should return null for unknown account", async () => {
      const manager = createAccountManager();
      const token = await manager.getAccessToken("unknown@example.com");

      expect(token).toBeNull();
    });

    it("should preserve original refreshToken when refresh returns empty", async () => {
      setStoredAuthStates({
        "user@example.com": {
          accessToken: "expired-token",
          refreshToken: "original-rt",
          idToken: "original-it",
          email: "user@example.com",
          expirationDate: "2000-01-01T00:00:00Z",
        },
      });
      mockRefresh.mockResolvedValue({
        accessToken: "refreshed-token",
        refreshToken: "",
        idToken: "",
        accessTokenExpirationDate: "2099-06-01T00:00:00Z",
      });

      const manager = createAccountManager();
      await manager.getAccessToken("user@example.com");

      const stored = getStoredAuthStates();
      expect(stored["user@example.com"].refreshToken).toBe("original-rt");
      expect(stored["user@example.com"].idToken).toBe("original-it");
    });
  });

  describe("removeAccount", () => {
    it("should revoke token and remove auth state", async () => {
      setStoredAuthStates({
        "user@example.com": {
          accessToken: "at",
          refreshToken: "rt",
          idToken: "it",
          email: "user@example.com",
          expirationDate: "2099-01-01T00:00:00Z",
        },
      });
      mockRevoke.mockResolvedValue(undefined);

      const manager = createAccountManager();
      await manager.removeAccount("user@example.com");

      expect(mockRevoke).toHaveBeenCalledTimes(1);
      expect(mockRevoke).toHaveBeenCalledWith(expect.any(Object), {
        tokenToRevoke: "rt",
      });

      const stored = getStoredAuthStates();
      expect(stored["user@example.com"]).toBeUndefined();
    });

    it("should remove auth state even when revocation fails", async () => {
      setStoredAuthStates({
        "user@example.com": {
          accessToken: "at",
          refreshToken: "rt",
          idToken: "it",
          email: "user@example.com",
          expirationDate: "2099-01-01T00:00:00Z",
        },
      });
      mockRevoke.mockRejectedValue(new Error("Network error"));

      const manager = createAccountManager();
      await manager.removeAccount("user@example.com");

      expect(mockRevoke).toHaveBeenCalledTimes(1);

      const stored = getStoredAuthStates();
      expect(stored["user@example.com"]).toBeUndefined();
    });

    it("should not affect other accounts", async () => {
      setStoredAuthStates({
        "alice@example.com": {
          accessToken: "at-a",
          refreshToken: "rt-a",
          idToken: "it-a",
          email: "alice@example.com",
          expirationDate: "2099-01-01T00:00:00Z",
        },
        "bob@example.com": {
          accessToken: "at-b",
          refreshToken: "rt-b",
          idToken: "it-b",
          email: "bob@example.com",
          expirationDate: "2099-01-01T00:00:00Z",
        },
      });
      mockRevoke.mockResolvedValue(undefined);

      const manager = createAccountManager();
      await manager.removeAccount("alice@example.com");

      const stored = getStoredAuthStates();
      expect(stored["alice@example.com"]).toBeUndefined();
      expect(stored["bob@example.com"]).toBeDefined();
    });

    it("should handle removing non-existent account gracefully", async () => {
      const manager = createAccountManager();
      await expect(
        manager.removeAccount("nonexistent@example.com"),
      ).resolves.toBeUndefined();

      expect(mockRevoke).not.toHaveBeenCalled();
    });
  });

  describe("getAllAccessTokens", () => {
    it("should return tokens for all accounts", async () => {
      setStoredAuthStates({
        "alice@example.com": {
          accessToken: "at-a",
          refreshToken: "rt-a",
          idToken: "it-a",
          email: "alice@example.com",
          expirationDate: "2099-01-01T00:00:00Z",
        },
        "bob@example.com": {
          accessToken: "at-b",
          refreshToken: "rt-b",
          idToken: "it-b",
          email: "bob@example.com",
          expirationDate: "2099-01-01T00:00:00Z",
        },
      });

      const manager = createAccountManager();
      const tokens = await manager.getAllAccessTokens();

      expect(tokens.size).toBe(2);
      expect(tokens.get("alice@example.com")).toBe("at-a");
      expect(tokens.get("bob@example.com")).toBe("at-b");
    });

    it("should exclude accounts whose tokens cannot be retrieved", async () => {
      setStoredAuthStates({
        "valid@example.com": {
          accessToken: "at-valid",
          refreshToken: "rt-valid",
          idToken: "it-valid",
          email: "valid@example.com",
          expirationDate: "2099-01-01T00:00:00Z",
        },
        "expired@example.com": {
          accessToken: "at-expired",
          refreshToken: "rt-expired",
          idToken: "it-expired",
          email: "expired@example.com",
          expirationDate: "2000-01-01T00:00:00Z",
        },
      });
      mockRefresh.mockRejectedValue(new Error("Refresh failed"));

      const manager = createAccountManager();
      const tokens = await manager.getAllAccessTokens();

      expect(tokens.size).toBe(1);
      expect(tokens.get("valid@example.com")).toBe("at-valid");
      expect(tokens.has("expired@example.com")).toBe(false);
    });

    it("should return empty map when no accounts exist", async () => {
      const manager = createAccountManager();
      const tokens = await manager.getAllAccessTokens();

      expect(tokens.size).toBe(0);
    });
  });
});

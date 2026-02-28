import { createHmsAuthService } from "../../../../src/core/platform/hms/authService";
import { HMS_AUTH_CONFIG } from "../../../../src/core/platform/hms/authConfig";
import { STORAGE_KEYS } from "../../../../src/core/storage/keys";

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

const mockExtractEmailFromIdToken = jest.fn();

jest.mock("../../../../src/core/platform/aosp/tokenUtils", () => ({
  extractEmailFromIdToken: (...args: unknown[]) =>
    mockExtractEmailFromIdToken(...args),
}));

function clearMockStore(): void {
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key];
  }
}

describe("createHmsAuthService", () => {
  beforeEach(() => {
    clearMockStore();
    jest.clearAllMocks();
  });

  describe("signIn", () => {
    it("should call authorize with HMS_AUTH_CONFIG", async () => {
      mockAuthorize.mockResolvedValue({
        accessToken: "at",
        refreshToken: "rt",
        idToken: "id-token",
        accessTokenExpirationDate: "2099-01-01T00:00:00Z",
      });
      mockExtractEmailFromIdToken.mockReturnValue("user@example.com");

      const auth = createHmsAuthService();
      await auth.signIn();

      expect(mockAuthorize).toHaveBeenCalledTimes(1);
      expect(mockAuthorize).toHaveBeenCalledWith(HMS_AUTH_CONFIG);
    });

    it("should extract email from idToken and save auth state", async () => {
      mockAuthorize.mockResolvedValue({
        accessToken: "access-token-123",
        refreshToken: "refresh-token-456",
        idToken: "valid-id-token",
        accessTokenExpirationDate: "2099-01-01T00:00:00Z",
      });
      mockExtractEmailFromIdToken.mockReturnValue("user@huawei.com");

      const auth = createHmsAuthService();
      const result = await auth.signIn();

      expect(mockExtractEmailFromIdToken).toHaveBeenCalledWith(
        "valid-id-token",
      );
      expect(result).toEqual({
        email: "user@huawei.com",
        accessToken: "access-token-123",
        idToken: "valid-id-token",
      });

      const stored = JSON.parse(mockStore[STORAGE_KEYS.HMS_AUTH_STATE]);
      expect(stored).toEqual({
        accessToken: "access-token-123",
        refreshToken: "refresh-token-456",
        idToken: "valid-id-token",
        email: "user@huawei.com",
        expirationDate: "2099-01-01T00:00:00Z",
      });
    });

    it("should handle missing idToken (email = '')", async () => {
      mockAuthorize.mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        idToken: "",
        accessTokenExpirationDate: "2099-01-01T00:00:00Z",
      });

      const auth = createHmsAuthService();
      const result = await auth.signIn();

      expect(mockExtractEmailFromIdToken).not.toHaveBeenCalled();
      expect(result.email).toBe("");
      expect(result.idToken).toBeUndefined();

      const stored = JSON.parse(mockStore[STORAGE_KEYS.HMS_AUTH_STATE]);
      expect(stored.email).toBe("");
    });
  });

  describe("signOut", () => {
    it("should revoke token and clear auth state", async () => {
      mockStore[STORAGE_KEYS.HMS_AUTH_STATE] = JSON.stringify({
        accessToken: "at",
        refreshToken: "rt",
        idToken: "it",
        email: "user@huawei.com",
        expirationDate: "2099-01-01T00:00:00Z",
      });
      mockRevoke.mockResolvedValue(undefined);

      const auth = createHmsAuthService();
      await auth.signOut();

      expect(mockRevoke).toHaveBeenCalledTimes(1);
      expect(mockRevoke).toHaveBeenCalledWith(HMS_AUTH_CONFIG, {
        tokenToRevoke: "rt",
      });
      expect(mockStore[STORAGE_KEYS.HMS_AUTH_STATE]).toBeUndefined();
    });

    it("should clear auth state even if revocation fails", async () => {
      mockStore[STORAGE_KEYS.HMS_AUTH_STATE] = JSON.stringify({
        accessToken: "at",
        refreshToken: "rt",
        idToken: "it",
        email: "user@huawei.com",
        expirationDate: "2099-01-01T00:00:00Z",
      });
      mockRevoke.mockRejectedValue(new Error("Network error"));

      const auth = createHmsAuthService();
      await auth.signOut();

      expect(mockRevoke).toHaveBeenCalledTimes(1);
      expect(mockStore[STORAGE_KEYS.HMS_AUTH_STATE]).toBeUndefined();
    });

    it("should clear auth state when no stored state exists", async () => {
      const auth = createHmsAuthService();
      await auth.signOut();

      expect(mockRevoke).not.toHaveBeenCalled();
      expect(mockStore[STORAGE_KEYS.HMS_AUTH_STATE]).toBeUndefined();
    });
  });

  describe("getAccessToken", () => {
    it("should return stored token when not expired", async () => {
      mockStore[STORAGE_KEYS.HMS_AUTH_STATE] = JSON.stringify({
        accessToken: "valid-token",
        refreshToken: "rt",
        idToken: "it",
        email: "user@huawei.com",
        expirationDate: "2099-01-01T00:00:00Z",
      });

      const auth = createHmsAuthService();
      const token = await auth.getAccessToken();

      expect(token).toBe("valid-token");
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("should refresh token when expired", async () => {
      mockStore[STORAGE_KEYS.HMS_AUTH_STATE] = JSON.stringify({
        accessToken: "expired-token",
        refreshToken: "rt",
        idToken: "it",
        email: "user@huawei.com",
        expirationDate: "2000-01-01T00:00:00Z",
      });
      mockRefresh.mockResolvedValue({
        accessToken: "new-token",
        refreshToken: "new-rt",
        idToken: "new-it",
        accessTokenExpirationDate: "2099-01-01T00:00:00Z",
      });

      const auth = createHmsAuthService();
      const token = await auth.getAccessToken();

      expect(token).toBe("new-token");
      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(mockRefresh).toHaveBeenCalledWith(HMS_AUTH_CONFIG, {
        refreshToken: "rt",
      });
    });

    it("should update stored state after successful refresh", async () => {
      mockStore[STORAGE_KEYS.HMS_AUTH_STATE] = JSON.stringify({
        accessToken: "expired-token",
        refreshToken: "rt",
        idToken: "it",
        email: "user@huawei.com",
        expirationDate: "2000-01-01T00:00:00Z",
      });
      mockRefresh.mockResolvedValue({
        accessToken: "refreshed-token",
        refreshToken: "refreshed-rt",
        idToken: "",
        accessTokenExpirationDate: "2099-06-01T00:00:00Z",
      });

      const auth = createHmsAuthService();
      await auth.getAccessToken();

      const stored = JSON.parse(mockStore[STORAGE_KEYS.HMS_AUTH_STATE]);
      expect(stored.accessToken).toBe("refreshed-token");
      expect(stored.refreshToken).toBe("refreshed-rt");
      expect(stored.expirationDate).toBe("2099-06-01T00:00:00Z");
      // When refresh returns empty idToken, the original is preserved
      expect(stored.idToken).toBe("it");
    });

    it("should return null when no stored state", async () => {
      const auth = createHmsAuthService();
      const token = await auth.getAccessToken();

      expect(token).toBeNull();
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("should return null when refresh fails", async () => {
      mockStore[STORAGE_KEYS.HMS_AUTH_STATE] = JSON.stringify({
        accessToken: "expired-token",
        refreshToken: "rt",
        idToken: "it",
        email: "user@huawei.com",
        expirationDate: "2000-01-01T00:00:00Z",
      });
      mockRefresh.mockRejectedValue(new Error("Refresh failed"));

      const auth = createHmsAuthService();
      const token = await auth.getAccessToken();

      expect(token).toBeNull();
    });
  });

  describe("isAvailable", () => {
    it("should always return true", async () => {
      const auth = createHmsAuthService();
      expect(await auth.isAvailable()).toBe(true);
    });
  });
});

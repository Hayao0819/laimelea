import { createGmsAuthService } from "../../../../src/core/platform/gms/authService";

const mockHasPlayServices = jest.fn();
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockGetTokens = jest.fn();
const mockConfigure = jest.fn();

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args),
    signIn: (...args: unknown[]) => mockSignIn(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
    getTokens: (...args: unknown[]) => mockGetTokens(...args),
    configure: (...args: unknown[]) => mockConfigure(...args),
  },
}));

describe("createGmsAuthService", () => {
  beforeEach(() => {
    mockHasPlayServices.mockReset();
    mockSignIn.mockReset();
    mockSignOut.mockReset();
    mockGetTokens.mockReset();
  });

  describe("signIn", () => {
    it("should call GoogleSignin.signIn and getTokens", async () => {
      mockSignIn.mockResolvedValue({
        type: "success",
        data: { user: { email: "test@example.com" } },
      });
      mockGetTokens.mockResolvedValue({
        accessToken: "access-123",
        idToken: "id-456",
      });

      const auth = createGmsAuthService();
      const result = await auth.signIn();

      expect(mockSignIn).toHaveBeenCalledTimes(1);
      expect(mockGetTokens).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        email: "test@example.com",
        accessToken: "access-123",
        idToken: "id-456",
      });
    });

    it("should throw when sign-in is cancelled (response.type !== 'success')", async () => {
      mockSignIn.mockResolvedValue({ type: "cancelled" });

      const auth = createGmsAuthService();
      await expect(auth.signIn()).rejects.toThrow(
        "Google sign-in was cancelled",
      );
      expect(mockGetTokens).not.toHaveBeenCalled();
    });
  });

  describe("signOut", () => {
    it("should call GoogleSignin.signOut", async () => {
      mockSignOut.mockResolvedValue(null);

      const auth = createGmsAuthService();
      await auth.signOut();

      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAccessToken", () => {
    it("should return access token from GoogleSignin.getTokens", async () => {
      mockGetTokens.mockResolvedValue({
        accessToken: "token-789",
        idToken: "id-000",
      });

      const auth = createGmsAuthService();
      const token = await auth.getAccessToken();

      expect(token).toBe("token-789");
      expect(mockGetTokens).toHaveBeenCalledTimes(1);
    });

    it("should return null when getTokens throws", async () => {
      mockGetTokens.mockRejectedValue(new Error("Not signed in"));

      const auth = createGmsAuthService();
      const token = await auth.getAccessToken();

      expect(token).toBeNull();
    });
  });

  describe("isAvailable", () => {
    it("should return true when hasPlayServices returns true", async () => {
      mockHasPlayServices.mockResolvedValue(true);

      const auth = createGmsAuthService();
      const available = await auth.isAvailable();

      expect(available).toBe(true);
      expect(mockHasPlayServices).toHaveBeenCalledWith({
        showPlayServicesUpdateDialog: false,
      });
    });

    it("should return false when hasPlayServices throws", async () => {
      mockHasPlayServices.mockRejectedValue(
        new Error("Play Services not available"),
      );

      const auth = createGmsAuthService();
      const available = await auth.isAvailable();

      expect(available).toBe(false);
    });
  });
});

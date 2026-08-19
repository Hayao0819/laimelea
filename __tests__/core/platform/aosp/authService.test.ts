import { createAospAuthService } from "../../../../src/core/platform/aosp/authService";

describe("createAospAuthService", () => {
  it("keeps cloud authentication unavailable", async () => {
    const auth = createAospAuthService();

    await expect(auth.isAvailable()).resolves.toBe(false);
    await expect(auth.getAccessToken()).resolves.toBeNull();
    await expect(auth.signOut()).resolves.toBeUndefined();
    await expect(auth.signIn()).rejects.toThrow(
      "Cloud authentication is unavailable on AOSP devices",
    );
  });
});

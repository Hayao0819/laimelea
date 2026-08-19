import { createPlatformServices } from "../../../src/core/platform/factory";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    getTokens: jest.fn(),
    configure: jest.fn(),
  },
}));

jest.mock("react-native-app-auth", () => ({
  authorize: jest.fn(),
  refresh: jest.fn(),
  revoke: jest.fn(),
}));

describe("createPlatformServices", () => {
  it('should create AOSP services with type "aosp"', () => {
    const services = createPlatformServices("aosp");
    expect(services.type).toBe("aosp");
    expect(services.auth).toBeDefined();
    expect(services.calendar).toBeDefined();
    expect(services.backup).toBeDefined();
    expect(services.sleep).toBeDefined();
  });

  it('should create GMS services with type "gms"', () => {
    const services = createPlatformServices("gms");
    expect(services.type).toBe("gms");
    expect(services.auth).toBeDefined();
    expect(services.calendar).toBeDefined();
    expect(services.backup).toBeDefined();
    expect(services.sleep).toBeDefined();
  });

  it('should create HMS services with type "hms"', () => {
    const services = createPlatformServices("hms");
    expect(services.type).toBe("hms");
    expect(services.auth).toBeDefined();
    expect(services.calendar).toBeDefined();
    expect(services.backup).toBeDefined();
    expect(services.sleep).toBeDefined();
  });

  it("keeps cloud authentication unavailable on AOSP", async () => {
    const aosp = createPlatformServices("aosp");
    const hms = createPlatformServices("hms");

    await expect(aosp.auth.isAvailable()).resolves.toBe(false);
    await expect(aosp.auth.getAccessToken()).resolves.toBeNull();
    await expect(aosp.auth.signIn()).rejects.toThrow(
      "Cloud authentication is unavailable on AOSP devices",
    );
    expect(aosp.auth.signIn).not.toBe(hms.auth.signIn);
  });

  it("should return different backup implementations for aosp vs hms", async () => {
    const aosp = createPlatformServices("aosp");
    const hms = createPlatformServices("hms");

    expect(aosp.backup.backup).not.toBe(hms.backup.backup);
  });

  it("should return different auth implementations for aosp vs gms", async () => {
    const aosp = createPlatformServices("aosp");
    const gms = createPlatformServices("gms");

    await expect(aosp.auth.isAvailable()).resolves.toBe(false);
    expect(aosp.auth.signIn).not.toBe(gms.auth.signIn);
  });
});

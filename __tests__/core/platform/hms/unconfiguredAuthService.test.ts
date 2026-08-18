describe("createHmsAuthService without a client ID", () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock("react-native-config");
  });

  it("reports that Huawei backup cannot be used", async () => {
    jest.doMock("react-native-config", () => ({
      HUAWEI_OAUTH_APP_ID: "",
    }));
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      __esModule: true,
      default: {
        getItem: jest.fn(),
        removeItem: jest.fn(),
      },
    }));
    jest.doMock("react-native-keychain", () => ({
      __esModule: true,
      getGenericPassword: jest.fn(),
      setGenericPassword: jest.fn(),
      resetGenericPassword: jest.fn(),
    }));
    jest.doMock("react-native-app-auth", () => ({
      authorize: jest.fn(),
      refresh: jest.fn(),
      revoke: jest.fn(),
    }));

    let createHmsAuthService: typeof import("../../../../src/core/platform/hms/authService").createHmsAuthService;
    jest.isolateModules(() => {
      ({
        createHmsAuthService,
      } = require("../../../../src/core/platform/hms/authService"));
    });

    const auth = createHmsAuthService!();
    await expect(auth.isAvailable()).resolves.toBe(false);
    await expect(auth.getAccessToken()).resolves.toBeNull();
    await expect(auth.signIn()).rejects.toThrow("OAuth client ID");
  });
});

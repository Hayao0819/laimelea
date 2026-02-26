import { detectPlatform } from "../../../src/core/platform/detection";

const mockHasPlayServices = jest.fn();

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args),
  },
}));

describe("detectPlatform", () => {
  beforeEach(() => {
    mockHasPlayServices.mockReset();
  });

  it('should return "gms" when Play Services is available', async () => {
    mockHasPlayServices.mockResolvedValue(true);
    const result = await detectPlatform();
    expect(result).toBe("gms");
    expect(mockHasPlayServices).toHaveBeenCalledWith({
      showPlayServicesUpdateDialog: false,
    });
  });

  it('should return "aosp" when Play Services returns false', async () => {
    mockHasPlayServices.mockResolvedValue(false);
    const result = await detectPlatform();
    expect(result).toBe("aosp");
  });

  it('should return "aosp" when Play Services throws', async () => {
    mockHasPlayServices.mockRejectedValue(new Error("not available"));
    const result = await detectPlatform();
    expect(result).toBe("aosp");
  });
});

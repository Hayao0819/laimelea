import {
  detectPlatform,
  getDeviceManufacturer,
} from "../../../src/core/platform/detection";

const mockHasPlayServices = jest.fn();

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args),
  },
}));

const mockGetManufacturer = jest.fn();

jest.mock("../../../src/core/platform/native/NativeDeviceInfoModule", () => ({
  __esModule: true,
  default: {
    getManufacturer: () => mockGetManufacturer(),
  },
}));

describe("getDeviceManufacturer", () => {
  beforeEach(() => {
    mockGetManufacturer.mockReset();
  });

  it("should return manufacturer from native module", () => {
    mockGetManufacturer.mockReturnValue("HUAWEI");
    expect(getDeviceManufacturer()).toBe("HUAWEI");
  });
});

describe("detectPlatform", () => {
  beforeEach(() => {
    mockHasPlayServices.mockReset();
    mockGetManufacturer.mockReset();
  });

  it('should return "gms" when Play Services is available', async () => {
    mockHasPlayServices.mockResolvedValue(true);
    const result = await detectPlatform();
    expect(result).toBe("gms");
    expect(mockHasPlayServices).toHaveBeenCalledWith({
      showPlayServicesUpdateDialog: false,
    });
  });

  it('should return "hms" when Play Services unavailable and manufacturer is HUAWEI', async () => {
    mockHasPlayServices.mockResolvedValue(false);
    mockGetManufacturer.mockReturnValue("HUAWEI");
    const result = await detectPlatform();
    expect(result).toBe("hms");
  });

  it('should return "hms" when Play Services throws and manufacturer is huawei (case insensitive)', async () => {
    mockHasPlayServices.mockRejectedValue(new Error("not available"));
    mockGetManufacturer.mockReturnValue("Huawei");
    const result = await detectPlatform();
    expect(result).toBe("hms");
  });

  it('should return "aosp" when Play Services returns false and not Huawei', async () => {
    mockHasPlayServices.mockResolvedValue(false);
    mockGetManufacturer.mockReturnValue("samsung");
    const result = await detectPlatform();
    expect(result).toBe("aosp");
  });

  it('should return "aosp" when Play Services throws and manufacturer is null', async () => {
    mockHasPlayServices.mockRejectedValue(new Error("not available"));
    mockGetManufacturer.mockReturnValue(null);
    const result = await detectPlatform();
    expect(result).toBe("aosp");
  });

  it('should return "aosp" when manufacturer check throws', async () => {
    mockHasPlayServices.mockResolvedValue(false);
    mockGetManufacturer.mockImplementation(() => {
      throw new Error("module not available");
    });
    const result = await detectPlatform();
    expect(result).toBe("aosp");
  });
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Keychain from "react-native-keychain";

import {
  getSecureItem,
  removeSecureItem,
  setSecureItem,
} from "../../../src/core/storage/secureStorage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock("react-native-keychain", () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
  STORAGE_TYPE: { AES_GCM_NO_AUTH: "KeystoreAESGCM_NoAuth" },
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockKeychain = Keychain as jest.Mocked<typeof Keychain>;
const secureStorageResult = {
  service: "test-service",
  storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
};

describe("secureStorage", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAsyncStorage.removeItem.mockResolvedValue();
  });

  it("returns the value stored in the platform secure store", async () => {
    mockKeychain.getGenericPassword.mockResolvedValue({
      username: "laimelea",
      password: "secure-value",
      service: "test-service",
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });

    await expect(getSecureItem("test-service", "legacy-key")).resolves.toBe(
      "secure-value",
    );
    expect(mockAsyncStorage.getItem).not.toHaveBeenCalled();
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("legacy-key");
  });

  it("reports a legacy cleanup failure when the secure value exists", async () => {
    mockKeychain.getGenericPassword.mockResolvedValue({
      username: "laimelea",
      password: "secure-value",
      service: "test-service",
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });
    mockAsyncStorage.removeItem.mockRejectedValue(new Error("unavailable"));

    await expect(getSecureItem("test-service", "legacy-key")).rejects.toThrow(
      "unavailable",
    );
  });

  it("moves a legacy value to the secure store before deleting it", async () => {
    mockKeychain.getGenericPassword.mockResolvedValue(false);
    mockAsyncStorage.getItem.mockResolvedValue("legacy-value");
    mockKeychain.setGenericPassword.mockResolvedValue(secureStorageResult);

    await expect(getSecureItem("test-service", "legacy-key")).resolves.toBe(
      "legacy-value",
    );
    expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
      "laimelea",
      "legacy-value",
      { service: "test-service" },
    );
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("legacy-key");
  });

  it("does not delete a legacy value when secure storage declines to save it", async () => {
    mockKeychain.getGenericPassword.mockResolvedValue(false);
    mockAsyncStorage.getItem.mockResolvedValue("legacy-value");
    mockKeychain.setGenericPassword.mockResolvedValue(false);

    await expect(getSecureItem("test-service", "legacy-key")).rejects.toThrow(
      "did not save",
    );
    expect(mockAsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it("rejects a direct write when secure storage declines it", async () => {
    mockKeychain.setGenericPassword.mockResolvedValue(false);

    await expect(setSecureItem("test-service", "secure-value")).rejects.toThrow(
      "did not save",
    );
  });

  it("deletes a legacy value only after a direct write succeeds", async () => {
    mockKeychain.setGenericPassword.mockResolvedValue(secureStorageResult);

    await setSecureItem("test-service", "secure-value", "legacy-key");

    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("legacy-key");
  });

  it("stores and clears values through the platform secure store", async () => {
    mockKeychain.setGenericPassword.mockResolvedValue(secureStorageResult);
    mockKeychain.getGenericPassword.mockResolvedValue({
      username: "laimelea",
      password: "secure-value",
      service: "test-service",
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });
    mockKeychain.resetGenericPassword.mockResolvedValue(true);

    await setSecureItem("test-service", "secure-value");
    await removeSecureItem("test-service", "legacy-key");

    expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
      "laimelea",
      "secure-value",
      { service: "test-service" },
    );
    expect(mockKeychain.resetGenericPassword).toHaveBeenCalledWith({
      service: "test-service",
    });
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("legacy-key");
  });

  it("removes the legacy value even when the secure store cleanup fails", async () => {
    mockKeychain.getGenericPassword.mockResolvedValue({
      username: "laimelea",
      password: "secure-value",
      service: "test-service",
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });
    mockKeychain.resetGenericPassword.mockResolvedValue(false);
    mockAsyncStorage.removeItem.mockResolvedValue();

    await expect(
      removeSecureItem("test-service", "legacy-key"),
    ).rejects.toThrow("did not remove");
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("legacy-key");
  });

  it("treats removal as complete when no secure value exists", async () => {
    mockKeychain.getGenericPassword.mockResolvedValue(false);

    await expect(
      removeSecureItem("test-service", "legacy-key"),
    ).resolves.toBeUndefined();

    expect(mockKeychain.resetGenericPassword).not.toHaveBeenCalled();
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("legacy-key");
  });
});

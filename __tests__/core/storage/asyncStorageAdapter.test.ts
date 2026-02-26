import { createAsyncStorage } from "../../../src/core/storage/asyncStorageAdapter";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

describe("createAsyncStorage", () => {
  it("should return a storage object", () => {
    const storage = createAsyncStorage<string>();
    expect(storage).toBeDefined();
  });

  it("should return a storage with getItem method", () => {
    const storage = createAsyncStorage<string>();
    expect(typeof storage.getItem).toBe("function");
  });

  it("should return a storage with setItem method", () => {
    const storage = createAsyncStorage<string>();
    expect(typeof storage.setItem).toBe("function");
  });

  it("should return a storage with removeItem method", () => {
    const storage = createAsyncStorage<string>();
    expect(typeof storage.removeItem).toBe("function");
  });

  it("should create independent storage instances for different types", () => {
    const stringStorage = createAsyncStorage<string>();
    const numberStorage = createAsyncStorage<number>();
    // Both should exist and be valid storages
    expect(stringStorage).toBeDefined();
    expect(numberStorage).toBeDefined();
  });
});

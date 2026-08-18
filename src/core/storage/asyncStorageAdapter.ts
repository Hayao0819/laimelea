import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage } from "jotai/utils";

interface JsonStorageOptions {
  reviver?: (key: string, value: unknown) => unknown;
  replacer?: (key: string, value: unknown) => unknown;
}

export function createAsyncStorage<T>(options?: JsonStorageOptions) {
  return createJSONStorage<T>(() => AsyncStorage, options);
}

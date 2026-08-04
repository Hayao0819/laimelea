import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Keychain from "react-native-keychain";

const SECURE_STORAGE_USERNAME = "laimelea";

async function saveToSecureStorage(
  service: string,
  value: string,
): Promise<void> {
  const saved = await Keychain.setGenericPassword(
    SECURE_STORAGE_USERNAME,
    value,
    {
      service,
    },
  );
  if (!saved) {
    throw new Error("Secure storage did not save the value");
  }
}

async function removeFromSecureStorage(service: string): Promise<void> {
  const credentials = await Keychain.getGenericPassword({ service });
  if (!credentials) {
    return;
  }
  const removed = await Keychain.resetGenericPassword({ service });
  if (!removed) {
    throw new Error("Secure storage did not remove the value");
  }
}

export async function getSecureItem(
  service: string,
  legacyStorageKey: string,
): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service });
  if (credentials) {
    await AsyncStorage.removeItem(legacyStorageKey);
    return credentials.password;
  }

  const legacyValue = await AsyncStorage.getItem(legacyStorageKey);
  if (legacyValue == null) {
    return null;
  }

  await saveToSecureStorage(service, legacyValue);
  await AsyncStorage.removeItem(legacyStorageKey);
  return legacyValue;
}

export async function setSecureItem(
  service: string,
  value: string,
  legacyStorageKey?: string,
): Promise<void> {
  await saveToSecureStorage(service, value);
  if (legacyStorageKey) {
    await AsyncStorage.removeItem(legacyStorageKey);
  }
}

export async function removeSecureItem(
  service: string,
  legacyStorageKey: string,
): Promise<void> {
  const results = await Promise.allSettled([
    removeFromSecureStorage(service),
    AsyncStorage.removeItem(legacyStorageKey),
  ]);
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) {
    throw failure.reason;
  }
}

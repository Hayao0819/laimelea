import { createStore } from "jotai";
import {
  platformTypeAtom,
  platformServicesAtom,
  accountManagerAtom,
} from "../../src/atoms/platformAtoms";
import type { PlatformType } from "../../src/core/platform/types";

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

describe("platformAtoms", () => {
  describe("platformTypeAtom", () => {
    it("should default to 'aosp'", () => {
      const store = createStore();
      expect(store.get(platformTypeAtom)).toBe("aosp");
    });

    it("should accept 'gms' value", () => {
      const store = createStore();
      store.set(platformTypeAtom, "gms");
      expect(store.get(platformTypeAtom)).toBe("gms");
    });

    it("should accept 'hms' value", () => {
      const store = createStore();
      store.set(platformTypeAtom, "hms");
      expect(store.get(platformTypeAtom)).toBe("hms");
    });
  });

  describe("accountManagerAtom", () => {
    it("should return accountManager with all required methods", () => {
      const store = createStore();
      const manager = store.get(accountManagerAtom);
      expect(typeof manager.getAccounts).toBe("function");
      expect(typeof manager.addAccount).toBe("function");
      expect(typeof manager.removeAccount).toBe("function");
      expect(typeof manager.getAccessToken).toBe("function");
      expect(typeof manager.getAllAccessTokens).toBe("function");
    });

    it("should update when platform type changes", () => {
      const store = createStore();
      const aospManager = store.get(accountManagerAtom);
      store.set(platformTypeAtom, "gms");
      const gmsManager = store.get(accountManagerAtom);
      expect(aospManager).toBeDefined();
      expect(gmsManager).toBeDefined();
    });
  });

  describe("platformServicesAtom", () => {
    it("should return AOSP services by default", () => {
      const store = createStore();
      const services = store.get(platformServicesAtom);
      expect(services).toBeDefined();
      expect(services.auth).toBeDefined();
      expect(services.calendar).toBeDefined();
      expect(services.backup).toBeDefined();
      expect(services.sleep).toBeDefined();
    });

    it("should return GMS services when platformType is 'gms'", () => {
      const store = createStore();
      store.set(platformTypeAtom, "gms");
      const services = store.get(platformServicesAtom);
      expect(services).toBeDefined();
      expect(services.auth).toBeDefined();
    });

    it("should update services when platform type changes", () => {
      const store = createStore();
      const aospServices = store.get(platformServicesAtom);
      store.set(platformTypeAtom, "gms");
      const gmsServices = store.get(platformServicesAtom);
      // Services should be different instances since platform changed
      expect(aospServices).not.toBe(gmsServices);
    });

    it("should return services with all required interface methods", () => {
      const platformTypes: PlatformType[] = ["aosp", "gms", "hms"];

      for (const type of platformTypes) {
        const store = createStore();
        store.set(platformTypeAtom, type);
        const services = store.get(platformServicesAtom);

        expect(typeof services.auth.signIn).toBe("function");
        expect(typeof services.auth.signOut).toBe("function");
        expect(typeof services.auth.getAccessToken).toBe("function");
        expect(typeof services.calendar.fetchEvents).toBe("function");
        expect(typeof services.backup.backup).toBe("function");
        expect(typeof services.backup.restore).toBe("function");
        expect(typeof services.sleep.fetchSleepSessions).toBe("function");
      }
    });
  });
});

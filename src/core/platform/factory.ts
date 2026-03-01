import {
  createAospAuthService,
  createAospCalendarService,
  createAospBackupService,
  createAospSleepService,
} from "./aosp";
import {
  createGmsAuthService,
  createGmsCalendarService,
  createGmsBackupService,
  createGmsSleepService,
} from "./gms";
import { createHmsAuthService, createHmsBackupService } from "./hms";
import { createAccountManager } from "../account/accountManager";
import type { PlatformServices, PlatformType } from "./types";

export function createPlatformServices(type: PlatformType): PlatformServices {
  const accountManager = createAccountManager();

  switch (type) {
    case "gms": {
      const auth = createGmsAuthService();
      return {
        type: "gms",
        auth,
        calendar: createGmsCalendarService(auth),
        backup: createGmsBackupService(auth),
        sleep: createGmsSleepService(),
        accountManager,
      };
    }
    case "hms": {
      const auth = createHmsAuthService();
      return {
        type: "hms",
        auth,
        calendar: createAospCalendarService(),
        backup: createHmsBackupService(auth),
        sleep: createAospSleepService(),
        accountManager,
      };
    }
    case "aosp":
      return {
        type: "aosp",
        auth: createAospAuthService(),
        calendar: createAospCalendarService(),
        backup: createAospBackupService(),
        sleep: createAospSleepService(),
        accountManager,
      };
  }
}

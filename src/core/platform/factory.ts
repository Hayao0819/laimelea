import {
  createAospAuthService,
  createAospCalendarService,
  createAospBackupService,
  createAospSleepService,
} from "./aosp";
import {
  createGmsAuthService,
  createGmsBackupService,
  createGmsSleepService,
} from "./gms";
import { createHmsAuthService, createHmsBackupService } from "./hms";
import type { PlatformServices, PlatformType } from "./types";

export function createPlatformServices(type: PlatformType): PlatformServices {
  switch (type) {
    case "gms": {
      const auth = createGmsAuthService();
      return {
        type: "gms",
        auth,
        calendar: createAospCalendarService(),
        backup: createGmsBackupService(auth),
        sleep: createGmsSleepService(),
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
      };
    }
    case "aosp":
      return {
        type: "aosp",
        auth: createAospAuthService(),
        calendar: createAospCalendarService(),
        backup: createAospBackupService(),
        sleep: createAospSleepService(),
      };
  }
}

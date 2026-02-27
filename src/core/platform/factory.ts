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
import type { PlatformServices, PlatformType } from "./types";

export function createPlatformServices(type: PlatformType): PlatformServices {
  switch (type) {
    case "gms": {
      const auth = createGmsAuthService();
      return {
        type: "gms",
        auth,
        calendar: createGmsCalendarService(auth),
        backup: createGmsBackupService(auth),
        sleep: createGmsSleepService(),
      };
    }
    case "hms":
      // HMS uses AOSP stubs until dedicated HMS services are implemented
      return {
        type: "hms",
        auth: createAospAuthService(),
        calendar: createAospCalendarService(),
        backup: createAospBackupService(),
        sleep: createAospSleepService(),
      };
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

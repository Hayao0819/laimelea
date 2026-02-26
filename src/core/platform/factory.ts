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
    case "gms":
      return {
        type: "gms",
        auth: createGmsAuthService(),
        calendar: createGmsCalendarService(),
        backup: createGmsBackupService(),
        sleep: createGmsSleepService(),
      };
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

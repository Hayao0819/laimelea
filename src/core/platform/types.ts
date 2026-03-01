import type { CalendarEvent } from "../../models/CalendarEvent";
import type { SleepSession } from "../../models/SleepSession";
import type { AccountManager } from "../account/types";

export type PlatformType = "gms" | "hms" | "aosp";

export interface AuthResult {
  email: string;
  accessToken: string;
  idToken?: string;
}

export interface PlatformAuthService {
  signIn(): Promise<AuthResult>;
  signOut(): Promise<void>;
  getAccessToken(): Promise<string | null>;
  isAvailable(): Promise<boolean>;
}

export interface CalendarInfo {
  id: string;
  name: string;
  color: string | null;
  isPrimary: boolean;
}

export interface PlatformCalendarService {
  fetchEvents(startMs: number, endMs: number): Promise<CalendarEvent[]>;
  getCalendarList(): Promise<CalendarInfo[]>;
  isAvailable(): Promise<boolean>;
}

export interface PlatformBackupService {
  backup(data: string): Promise<void>;
  restore(): Promise<string | null>;
  getLastBackupTime(): Promise<number | null>;
  isAvailable(): Promise<boolean>;
}

export interface PlatformSleepService {
  fetchSleepSessions(startMs: number, endMs: number): Promise<SleepSession[]>;
  requestPermissions(): Promise<boolean>;
  isAvailable(): Promise<boolean>;
}

export interface PlatformServices {
  type: PlatformType;
  auth: PlatformAuthService;
  calendar: PlatformCalendarService;
  backup: PlatformBackupService;
  sleep: PlatformSleepService;
  accountManager: AccountManager;
}

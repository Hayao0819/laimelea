export const STORAGE_KEYS = {
  SETTINGS: "@laimelea/settings",
  ALARMS: "@laimelea/alarms",
  CALENDAR_CACHE: "@laimelea/calendar_cache",
  CALENDAR_LAST_SYNC: "@laimelea/calendar_last_sync",
  CALENDAR_LIST: "@laimelea/calendar_list",
  CALENDAR_VIEW_MODE: "@laimelea/calendar_view_mode",
  SLEEP_SESSIONS: "@laimelea/sleep_sessions",
  TIMER_STATE: "@laimelea/timer_state",
  TIMER_COMPLETIONS: "@laimelea/timer_completions",
  BACKUP_DATA: "@laimelea/backup_data",
  BACKUP_TIMESTAMP: "@laimelea/backup_timestamp",
  PENDING_BACKUP_RESTORE: "@laimelea/pending_backup_restore",
  AOSP_AUTH_STATE: "@laimelea/aosp_auth_state",
  HMS_AUTH_STATE: "@laimelea/hms_auth_state",
  GAME_2048: "@laimelea/game_2048",
  STOPWATCH_STATE: "@laimelea/stopwatch_state",
} as const;

export const SECURE_STORAGE_SERVICES = {
  AOSP_AUTH_STATE: "com.hayao0819.laimelea.auth.aosp",
  HMS_AUTH_STATE: "com.hayao0819.laimelea.auth.hms",
} as const;

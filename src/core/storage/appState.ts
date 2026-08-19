import type { Alarm, AlarmRepeat } from "../../models/Alarm";
import {
  type AppSettings,
  DEFAULT_ALARM_DEFAULTS,
  DEFAULT_SETTINGS,
  DEFAULT_WIDGET_SETTINGS,
} from "../../models/Settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isSafeInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

function isOneOf<T extends string | number>(
  value: unknown,
  values: readonly T[],
): value is T {
  return (
    (typeof value === "string" || typeof value === "number") &&
    values.includes(value as T)
  );
}

function nullableString(value: unknown): string | null | undefined {
  return value == null || typeof value === "string" ? value : undefined;
}

function nullableNumber(value: unknown): number | null | undefined {
  return value == null || isFiniteNumber(value) ? value : undefined;
}

function hexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)
    ? value
    : fallback;
}

export function normalizeSettings(value: unknown): AppSettings | null {
  if (!isRecord(value)) return null;

  const cycleConfig = value.cycleConfig === undefined ? {} : value.cycleConfig;
  const alarmDefaults =
    value.alarmDefaults === undefined ? {} : value.alarmDefaults;
  const widgetSettings =
    value.widgetSettings === undefined ? {} : value.widgetSettings;
  if (
    !isRecord(cycleConfig) ||
    !isRecord(alarmDefaults) ||
    !isRecord(widgetSettings)
  ) {
    return null;
  }
  if (
    (cycleConfig.cycleLengthMinutes !== undefined &&
      (!isFiniteNumber(cycleConfig.cycleLengthMinutes) ||
        cycleConfig.cycleLengthMinutes <= 0)) ||
    (cycleConfig.baseTimeMs !== undefined &&
      !isFiniteNumber(cycleConfig.baseTimeMs)) ||
    (value.setupComplete !== undefined &&
      typeof value.setupComplete !== "boolean") ||
    (value.primaryTimeDisplay !== undefined &&
      !isOneOf(value.primaryTimeDisplay, ["custom", "24h"] as const)) ||
    (value.language !== undefined && typeof value.language !== "string") ||
    (value.theme !== undefined &&
      !isOneOf(value.theme, ["light", "dark", "system"] as const)) ||
    (value.timeFormat !== undefined &&
      !isOneOf(value.timeFormat, ["12h", "24h"] as const)) ||
    (value.detectedPlatform !== undefined &&
      !isOneOf(value.detectedPlatform, ["aosp", "gms", "hms"] as const)) ||
    (value.timezone !== undefined && typeof value.timezone !== "string") ||
    (value.dstHandling !== undefined &&
      !isOneOf(value.dstHandling, ["auto", "ignore"] as const)) ||
    (value.secondaryTimezone !== undefined &&
      nullableString(value.secondaryTimezone) === undefined) ||
    (value.calendarFirstDayOfWeek !== undefined &&
      !isOneOf(value.calendarFirstDayOfWeek, [0, 1, 6] as const)) ||
    (value.defaultEventReminderMin !== undefined &&
      !isNonNegativeInteger(value.defaultEventReminderMin)) ||
    (value.visibleCalendarIds !== undefined &&
      (!Array.isArray(value.visibleCalendarIds) ||
        !value.visibleCalendarIds.every((id) => typeof id === "string"))) ||
    (value.lastBackupTimestamp !== undefined &&
      nullableNumber(value.lastBackupTimestamp) === undefined) ||
    (alarmDefaults.dismissalMethod !== undefined &&
      !isOneOf(alarmDefaults.dismissalMethod, [
        "simple",
        "shake",
        "math",
      ] as const)) ||
    (alarmDefaults.gradualVolumeDurationSec !== undefined &&
      !isNonNegativeInteger(alarmDefaults.gradualVolumeDurationSec)) ||
    (alarmDefaults.snoozeDurationMin !== undefined &&
      !isPositiveInteger(alarmDefaults.snoozeDurationMin)) ||
    (alarmDefaults.snoozeMaxCount !== undefined &&
      !isNonNegativeInteger(alarmDefaults.snoozeMaxCount)) ||
    (alarmDefaults.vibrationEnabled !== undefined &&
      typeof alarmDefaults.vibrationEnabled !== "boolean") ||
    (alarmDefaults.volumeButtonBehavior !== undefined &&
      !isOneOf(alarmDefaults.volumeButtonBehavior, [
        "snooze",
        "dismiss",
        "volume",
      ] as const)) ||
    (alarmDefaults.mathDifficulty !== undefined &&
      !isOneOf(alarmDefaults.mathDifficulty, [1, 2, 3] as const)) ||
    (widgetSettings.opacity !== undefined &&
      (!isFiniteNumber(widgetSettings.opacity) ||
        widgetSettings.opacity < 0 ||
        widgetSettings.opacity > 100)) ||
    (widgetSettings.borderRadius !== undefined &&
      (!isFiniteNumber(widgetSettings.borderRadius) ||
        widgetSettings.borderRadius < 0)) ||
    (widgetSettings.showRealTime !== undefined &&
      typeof widgetSettings.showRealTime !== "boolean") ||
    (widgetSettings.showNextAlarm !== undefined &&
      typeof widgetSettings.showNextAlarm !== "boolean")
  ) {
    return null;
  }

  return {
    cycleConfig: {
      cycleLengthMinutes:
        cycleConfig.cycleLengthMinutes ??
        DEFAULT_SETTINGS.cycleConfig.cycleLengthMinutes,
      baseTimeMs:
        cycleConfig.baseTimeMs ?? DEFAULT_SETTINGS.cycleConfig.baseTimeMs,
    },
    setupComplete: value.setupComplete ?? DEFAULT_SETTINGS.setupComplete,
    primaryTimeDisplay:
      value.primaryTimeDisplay ?? DEFAULT_SETTINGS.primaryTimeDisplay,
    language: value.language ?? DEFAULT_SETTINGS.language,
    theme: value.theme ?? DEFAULT_SETTINGS.theme,
    timeFormat: value.timeFormat ?? DEFAULT_SETTINGS.timeFormat,
    detectedPlatform:
      value.detectedPlatform ?? DEFAULT_SETTINGS.detectedPlatform,
    timezone: value.timezone ?? DEFAULT_SETTINGS.timezone,
    dstHandling: value.dstHandling ?? DEFAULT_SETTINGS.dstHandling,
    secondaryTimezone:
      value.secondaryTimezone === undefined
        ? DEFAULT_SETTINGS.secondaryTimezone
        : (nullableString(value.secondaryTimezone) ?? null),
    alarmDefaults: {
      ...DEFAULT_ALARM_DEFAULTS,
      dismissalMethod:
        alarmDefaults.dismissalMethod ?? DEFAULT_ALARM_DEFAULTS.dismissalMethod,
      gradualVolumeDurationSec:
        alarmDefaults.gradualVolumeDurationSec ??
        DEFAULT_ALARM_DEFAULTS.gradualVolumeDurationSec,
      snoozeDurationMin:
        alarmDefaults.snoozeDurationMin ??
        DEFAULT_ALARM_DEFAULTS.snoozeDurationMin,
      snoozeMaxCount:
        alarmDefaults.snoozeMaxCount ?? DEFAULT_ALARM_DEFAULTS.snoozeMaxCount,
      vibrationEnabled:
        alarmDefaults.vibrationEnabled ??
        DEFAULT_ALARM_DEFAULTS.vibrationEnabled,
      volumeButtonBehavior:
        alarmDefaults.volumeButtonBehavior ??
        DEFAULT_ALARM_DEFAULTS.volumeButtonBehavior,
      mathDifficulty:
        alarmDefaults.mathDifficulty ?? DEFAULT_ALARM_DEFAULTS.mathDifficulty,
    },
    calendarFirstDayOfWeek:
      value.calendarFirstDayOfWeek ?? DEFAULT_SETTINGS.calendarFirstDayOfWeek,
    defaultEventReminderMin:
      value.defaultEventReminderMin ?? DEFAULT_SETTINGS.defaultEventReminderMin,
    visibleCalendarIds:
      value.visibleCalendarIds === undefined
        ? DEFAULT_SETTINGS.visibleCalendarIds
        : [...value.visibleCalendarIds],
    lastBackupTimestamp:
      value.lastBackupTimestamp === undefined
        ? DEFAULT_SETTINGS.lastBackupTimestamp
        : (nullableNumber(value.lastBackupTimestamp) ?? null),
    widgetSettings: {
      backgroundColor: hexColor(
        widgetSettings.backgroundColor,
        DEFAULT_WIDGET_SETTINGS.backgroundColor,
      ),
      textColor: hexColor(
        widgetSettings.textColor,
        DEFAULT_WIDGET_SETTINGS.textColor,
      ),
      secondaryTextColor: hexColor(
        widgetSettings.secondaryTextColor,
        DEFAULT_WIDGET_SETTINGS.secondaryTextColor,
      ),
      accentColor: hexColor(
        widgetSettings.accentColor,
        DEFAULT_WIDGET_SETTINGS.accentColor,
      ),
      opacity: widgetSettings.opacity ?? DEFAULT_WIDGET_SETTINGS.opacity,
      borderRadius:
        widgetSettings.borderRadius ?? DEFAULT_WIDGET_SETTINGS.borderRadius,
      showRealTime:
        widgetSettings.showRealTime ?? DEFAULT_WIDGET_SETTINGS.showRealTime,
      showNextAlarm:
        widgetSettings.showNextAlarm ?? DEFAULT_WIDGET_SETTINGS.showNextAlarm,
    },
  };
}

export function resolveSettings(stored: unknown): AppSettings {
  return normalizeSettings(stored) ?? DEFAULT_SETTINGS;
}

function normalizeRepeat(value: unknown): AlarmRepeat | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (
    value.type === "interval" &&
    isFiniteNumber(value.intervalMs) &&
    value.intervalMs > 0
  ) {
    return { type: "interval", intervalMs: value.intervalMs };
  }
  if (
    value.type === "weekdays" &&
    Array.isArray(value.weekdays) &&
    value.weekdays.every((day) => isInteger(day) && day >= 0 && day <= 6)
  ) {
    return { type: "weekdays", weekdays: [...value.weekdays] };
  }
  if (
    value.type === "customCycleInterval" &&
    isFiniteNumber(value.customCycleIntervalDays) &&
    value.customCycleIntervalDays > 0
  ) {
    return {
      type: "customCycleInterval",
      customCycleIntervalDays: value.customCycleIntervalDays,
    };
  }
  return undefined;
}

export function normalizeAlarm(value: unknown): Alarm | null {
  if (!isRecord(value)) return null;
  const repeat =
    value.repeat === undefined ? null : normalizeRepeat(value.repeat);
  if (repeat === undefined) return null;
  const linkedEventOffsetMs =
    value.linkedEventOffsetMs === undefined
      ? (value.linkedEventOffset ?? 0)
      : value.linkedEventOffsetMs;
  if (
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    typeof value.enabled !== "boolean" ||
    !isFiniteNumber(value.targetTimestampMs) ||
    (value.recurrenceAnchorTimestampMs !== undefined &&
      nullableNumber(value.recurrenceAnchorTimestampMs) === undefined) ||
    !isOneOf(value.setInTimeSystem, ["custom", "24h"] as const) ||
    !isOneOf(value.dismissalMethod, ["simple", "shake", "math"] as const) ||
    !isNonNegativeInteger(value.gradualVolumeDurationSec) ||
    !isPositiveInteger(value.snoozeDurationMin) ||
    !isNonNegativeInteger(value.snoozeMaxCount) ||
    !isNonNegativeInteger(value.snoozeCount) ||
    value.snoozeCount > value.snoozeMaxCount ||
    !isNonNegativeInteger(value.autoSilenceMin) ||
    nullableString(value.soundUri) === undefined ||
    typeof value.vibrationEnabled !== "boolean" ||
    nullableString(value.notifeeTriggerId) === undefined ||
    typeof value.skipNextOccurrence !== "boolean" ||
    nullableString(value.linkedCalendarEventId) === undefined ||
    (value.linkedCalendarSourceEventId !== undefined &&
      nullableString(value.linkedCalendarSourceEventId) === undefined) ||
    !isFiniteNumber(linkedEventOffsetMs) ||
    (value.mathDifficulty !== undefined &&
      !isOneOf(value.mathDifficulty, [1, 2, 3] as const)) ||
    (value.isTest !== undefined && typeof value.isTest !== "boolean") ||
    nullableNumber(value.lastFiredAt) === undefined ||
    (value.activeOccurrenceTimestampMs !== undefined &&
      nullableNumber(value.activeOccurrenceTimestampMs) === undefined) ||
    (value.lastDeliveredOccurrenceTimestampMs !== undefined &&
      nullableNumber(value.lastDeliveredOccurrenceTimestampMs) === undefined) ||
    !isFiniteNumber(value.createdAt) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    return null;
  }
  return {
    id: value.id,
    label: value.label,
    enabled: value.enabled,
    targetTimestampMs: value.targetTimestampMs,
    recurrenceAnchorTimestampMs:
      nullableNumber(value.recurrenceAnchorTimestampMs) ?? null,
    setInTimeSystem: value.setInTimeSystem,
    repeat,
    dismissalMethod: value.dismissalMethod,
    gradualVolumeDurationSec: value.gradualVolumeDurationSec,
    snoozeDurationMin: value.snoozeDurationMin,
    snoozeMaxCount: value.snoozeMaxCount,
    snoozeCount: value.snoozeCount,
    autoSilenceMin: value.autoSilenceMin,
    soundUri: nullableString(value.soundUri) ?? null,
    vibrationEnabled: value.vibrationEnabled,
    notifeeTriggerId: nullableString(value.notifeeTriggerId) ?? null,
    skipNextOccurrence: value.skipNextOccurrence,
    linkedCalendarEventId: nullableString(value.linkedCalendarEventId) ?? null,
    linkedCalendarSourceEventId:
      nullableString(value.linkedCalendarSourceEventId) ?? null,
    linkedEventOffsetMs,
    mathDifficulty:
      value.mathDifficulty ?? DEFAULT_ALARM_DEFAULTS.mathDifficulty,
    ...(value.isTest === undefined ? {} : { isTest: value.isTest }),
    lastFiredAt: nullableNumber(value.lastFiredAt) ?? null,
    activeOccurrenceTimestampMs:
      nullableNumber(value.activeOccurrenceTimestampMs) ?? null,
    lastDeliveredOccurrenceTimestampMs:
      nullableNumber(value.lastDeliveredOccurrenceTimestampMs) ?? null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function normalizeAlarms(value: unknown): Alarm[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const alarms = value
    .map(normalizeAlarm)
    .filter((alarm): alarm is Alarm => alarm !== null);
  return value.length > 0 && alarms.length === 0 ? null : alarms;
}

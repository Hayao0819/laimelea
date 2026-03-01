# Terminology / 用語表

Canonical terminology for the Laimelea codebase. All code, i18n keys, docs, and comments must follow these conventions.

## Time System

The app has two time systems. Use the following terms consistently:

| Concept                                | Canonical Term (code) | i18n Key           | EN Display    | JA Display     | Notes                         |
| -------------------------------------- | --------------------- | ------------------ | ------------- | -------------- | ----------------------------- |
| App-specific time based on CycleConfig | `customTime`          | `clock.customTime` | "Custom Time" | "カスタム時間" | Derived from `realToCustom()` |
| Standard 24-hour real-world time       | `realTime`            | `clock.realTime`   | "24h Time"    | "24時間"       | Unix epoch based              |
| Time system selector value (custom)    | `"custom"`            | —                  | —             | —              | Type union literal            |
| Time system selector value (24h)       | `"24h"`               | —                  | —             | —              | Type union literal            |

### Naming Rules

- **Variables**: `realTimeMs` (timestamp), `realFormatted` (display string)
- **Variables**: `customTime` (CustomTimeValue object), `customFormatted` (display string)
- **Conversion functions**: `realToCustom()`, `customToReal()` — parameter is `realTimestampMs`
- **i18n keys**: Use `realTime` (not ~~`standardTime`~~)
- **Type unions**: `"custom" | "24h"` — these are data values, not display terms
- **Settings property**: `primaryTimeDisplay: "custom" | "24h"`

### Prohibited Terms

| Do NOT use                               | Use instead  | Reason                                               |
| ---------------------------------------- | ------------ | ---------------------------------------------------- |
| `standardTime` (as i18n key or variable) | `realTime`   | Ambiguous (could mean timezone standard time vs DST) |
| `normalTime`                             | `realTime`   | Vague                                                |
| `systemTime`                             | `realTime`   | Confusing with OS-level system time                  |
| `virtualTime`                            | `customTime` | Not used in codebase                                 |
| `extendedTime`                           | `customTime` | Not used in codebase                                 |

## Cycle Configuration

| Concept                       | Canonical Term       | Type          | Notes                                          |
| ----------------------------- | -------------------- | ------------- | ---------------------------------------------- |
| Cycle configuration object    | `cycleConfig`        | `CycleConfig` | Contains `cycleLengthMinutes` and `baseTimeMs` |
| Duration of one custom day    | `cycleLengthMinutes` | `number`      | In minutes (e.g., 1560 = 26h)                  |
| Reference timestamp for Day 0 | `baseTimeMs`         | `number`      | Unix ms                                        |
| Custom day number             | `day`                | `number`      | 0-indexed, can be negative                     |

### Prohibited Terms

| Do NOT use                          | Use instead          |
| ----------------------------------- | -------------------- |
| `dayLength`                         | `cycleLengthMinutes` |
| `cycleLength` (without unit suffix) | `cycleLengthMinutes` |
| `dayConfig`                         | `cycleConfig`        |

## Timestamps and Durations

All timestamps are Unix milliseconds. Use unit suffixes consistently:

| Suffix | Meaning      | Examples                                                                   |
| ------ | ------------ | -------------------------------------------------------------------------- |
| `Ms`   | Milliseconds | `realTimeMs`, `startTimestampMs`, `durationMs`, `elapsedMs`, `remainingMs` |
| `Min`  | Minutes      | `snoozeDurationMin`, `autoSilenceMin`, `cycleLengthMinutes`                |
| `Sec`  | Seconds      | `gradualVolumeDurationSec`                                                 |

### Timestamp Property Pattern

- Event boundaries: `startTimestampMs` / `endTimestampMs`
- Alarm target: `targetTimestampMs`
- Metadata: `createdAt`, `updatedAt`, `lastFiredAt` (Unix ms without suffix — legacy pattern, acceptable)

## Alarm

| Concept                          | Canonical Term             | Type/Value          | Notes                                                |
| -------------------------------- | -------------------------- | ------------------- | ---------------------------------------------------- |
| Alarm model                      | `Alarm`                    | interface           | `src/models/Alarm.ts`                                |
| Alarm dismissal approach         | `dismissalMethod`          | `DismissalMethod`   | `"simple" \| "shake" \| "math"`                      |
| Dismissal strategy interface     | `DismissalStrategy`        | interface           | Strategy Pattern                                     |
| Dismissal UI component           | `*Dismissal`               | component           | `SimpleDismissal`, `ShakeDismissal`, `MathDismissal` |
| Snooze duration                  | `snoozeDurationMin`        | `number`            | Minutes                                              |
| Snooze limit                     | `snoozeMaxCount`           | `number`            | Count                                                |
| Current snooze count             | `snoozeCount`              | `number`            | Count                                                |
| Auto-silence timeout             | `autoSilenceMin`           | `number`            | Minutes                                              |
| Gradual volume ramp              | `gradualVolumeDurationSec` | `number`            | Seconds                                              |
| Notifee trigger reference        | `notifeeTriggerId`         | `string \| null`    | Notifee internal ID                                  |
| Time system the alarm was set in | `setInTimeSystem`          | `"custom" \| "24h"` | —                                                    |
| Linked calendar event            | `linkedCalendarEventId`    | `string \| null`    | —                                                    |
| Linked event offset              | `linkedEventOffsetMs`      | `number`            | Ms before/after event start                          |

### Alarm Repeat

| Concept                        | Canonical Term            | Value                                                        |
| ------------------------------ | ------------------------- | ------------------------------------------------------------ |
| Repeat type interface          | `AlarmRepeat`             | `{ type, intervalMs?, weekdays?, customCycleIntervalDays? }` |
| Fixed interval repeat          | `"interval"`              | Real-time interval                                           |
| Weekday-based repeat           | `"weekdays"`              | Real-world weekdays (0=Sun)                                  |
| Custom cycle repeat            | `"customCycleInterval"`   | Every N custom days                                          |
| Repeat interval in custom days | `customCycleIntervalDays` | `number`                                                     |

## Bulk Alarm Creation

| Concept                  | Canonical Term       | Notes     |
| ------------------------ | -------------------- | --------- |
| Bulk creation parameters | `BulkAlarmParams`    | Interface |
| Form component           | `BulkAlarmForm`      | —         |
| Screen                   | `BulkAlarmScreen`    | —         |
| Service function         | `createBulkAlarms()` | —         |

## Calendar

| Concept                            | Canonical Term                        | Type                              | Notes                         |
| ---------------------------------- | ------------------------------------- | --------------------------------- | ----------------------------- |
| Calendar event model               | `CalendarEvent`                       | interface                         | `src/models/CalendarEvent.ts` |
| Calendar metadata                  | `CalendarInfo`                        | interface                         | id, name, color, isPrimary    |
| Event source platform              | `source`                              | `"google" \| "local" \| "huawei"` | —                             |
| Original event ID in source system | `sourceEventId`                       | `string`                          | —                             |
| Event time range                   | `startTimestampMs` / `endTimestampMs` | `number`                          | Unix ms                       |

## Sleep

| Concept                 | Canonical Term    | Type                           | Notes                                                       |
| ----------------------- | ----------------- | ------------------------------ | ----------------------------------------------------------- |
| Sleep session model     | `SleepSession`    | interface                      | `src/models/SleepSession.ts`                                |
| Sleep stage             | `SleepStage`      | interface                      | Sub-segment of a session                                    |
| Stage type              | `SleepStageType`  | union type                     | `"unknown" \| "awake" \| "light" \| "deep" \| "rem" \| ...` |
| Session source          | `source`          | `"health_connect" \| "manual"` | —                                                           |
| Cycle estimation result | `CycleEstimation` | interface                      | Linear regression output                                    |

## Timer

| Concept                  | Canonical Term   | Type      | Notes                 |
| ------------------------ | ---------------- | --------- | --------------------- |
| Countdown timer state    | `TimerState`     | interface | `src/models/Timer.ts` |
| Stopwatch state          | `StopwatchState` | interface | —                     |
| Total timer duration     | `durationMs`     | `number`  | Milliseconds          |
| Remaining time           | `remainingMs`    | `number`  | Milliseconds          |
| Elapsed time (stopwatch) | `elapsedMs`      | `number`  | Milliseconds          |

## Platform Abstraction

| Concept                   | Canonical Term               | Type                       | Notes                        |
| ------------------------- | ---------------------------- | -------------------------- | ---------------------------- |
| Platform type             | `PlatformType`               | `"gms" \| "hms" \| "aosp"` | —                            |
| Service container         | `PlatformServices`           | interface                  | Groups all platform services |
| Auth service              | `PlatformAuthService`        | interface                  | —                            |
| Calendar service          | `PlatformCalendarService`    | interface                  | —                            |
| Backup service            | `PlatformBackupService`      | interface                  | —                            |
| Sleep service             | `PlatformSleepService`       | interface                  | —                            |
| Factory function          | `createPlatformServices()`   | function                   | —                            |
| Platform-specific factory | `create{Gms,Aosp}*Service()` | function                   | camelCase                    |

## Naming Conventions Summary

| Category               | Convention                                | Examples                                        |
| ---------------------- | ----------------------------------------- | ----------------------------------------------- |
| Variables / functions  | camelCase                                 | `realTimeMs`, `formatCustomTime()`              |
| Types / interfaces     | PascalCase, no `I` prefix                 | `CycleConfig`, `Alarm`, `PlatformServices`      |
| Components             | PascalCase                                | `DigitalClock`, `AlarmEditScreen`               |
| Screens                | `*Screen` suffix                          | `ClockScreen`, `CalendarScreen`                 |
| Services               | `*Service` suffix                         | `PlatformAuthService`                           |
| Strategies             | `*Strategy` suffix                        | `DismissalStrategy`                             |
| Props interfaces       | `Props` or `*Props`                       | `DigitalClockProps`, `BulkAlarmFormProps`       |
| Jotai atoms            | `*Atom` suffix                            | `settingsAtom`, `platformTypeAtom`              |
| i18n keys              | `feature.camelCaseKey`                    | `clock.customTime`, `alarm.dismissal`           |
| Test files             | `*.test.ts` / `*.test.tsx`                | Never `.spec.ts`                                |
| Test helpers           | `make*()` for data, `create*()` for setup | `makeAlarm()`, `createWrapper()`                |
| Constants              | UPPER_SNAKE_CASE                          | `MS_PER_SECOND`, `DEFAULT_CYCLE_LENGTH_MINUTES` |
| Files (components)     | PascalCase                                | `DigitalClock.tsx`, `AlarmEditScreen.tsx`       |
| Files (utils/services) | camelCase                                 | `conversions.ts`, `alarmScheduler.ts`           |
| Files (atoms/hooks)    | camelCase                                 | `clockAtoms.ts`, `useCurrentTime.ts`            |

## i18n Key Structure

Top-level namespaces:

```text
tabs.*        — Tab bar labels
clock.*       — Clock screen UI
alarm.*       — Alarm feature UI
dismissal.*   — Dismissal method UI
calendar.*    — Calendar feature UI
sleep.*       — Sleep feature UI
timer.*       — Timer feature UI
settings.*    — Settings screen UI
setup.*       — Initial setup flow UI
common.*      — Shared labels (save, cancel, delete, etc.)
```

All keys use camelCase within each namespace.

import notifee, {
  type TimestampTrigger,
  TriggerType,
} from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDefaultStore } from "jotai";
import { NativeModules, Platform } from "react-native";

import { timersAtom } from "../../../atoms/timerAtoms";
import {
  getAlarmDeliveryStatus,
  TIMER_CHANNEL_ID,
} from "../../../core/notifications/notifeeSetup";
import { STORAGE_KEYS } from "../../../core/storage/keys";
import { completeTimers } from "./timerState";

let timerStateQueue: Promise<void> = Promise.resolve();
let timerNotificationQueue: Promise<void> = Promise.resolve();

export const ANDROID_TIMER_TRIGGER_LIMIT = 50;

interface NativeTimerModule {
  scheduleTimer(
    timerId: string,
    label: string,
    remainingMs: number,
  ): Promise<void>;
  cancelTimer(timerId: string): Promise<void>;
  consumeCompletedTimers(): Promise<unknown>;
  getTimerRemainingMs(timerId: string): Promise<unknown>;
  getScheduledTimerIds(): Promise<unknown>;
}

export async function readNativeScheduledTimerIds(): Promise<string[] | null> {
  const module = nativeTimerModule();
  if (typeof module?.getScheduledTimerIds !== "function") return null;

  try {
    const timerIds = await module.getScheduledTimerIds();
    return Array.isArray(timerIds)
      ? timerIds.filter((id): id is string => typeof id === "string")
      : null;
  } catch {
    return null;
  }
}

export async function readNativeTimerRemainingMs(
  timerId: string,
): Promise<number | null> {
  const module = nativeTimerModule();
  if (typeof module?.getTimerRemainingMs !== "function") return null;

  try {
    const remainingMs = await module.getTimerRemainingMs(timerId);
    return typeof remainingMs === "number" &&
      Number.isFinite(remainingMs) &&
      remainingMs >= 0
      ? remainingMs
      : null;
  } catch {
    return null;
  }
}

function nativeTimerModule(): Partial<NativeTimerModule> | undefined {
  if (Platform.OS !== "android") return undefined;
  return (NativeModules as { RingtoneModule?: Partial<NativeTimerModule> })
    .RingtoneModule;
}

function nativeTimerDeliveryAvailable(
  module: Partial<NativeTimerModule> | undefined,
): module is NativeTimerModule {
  return (
    typeof module?.scheduleTimer === "function" &&
    typeof module.cancelTimer === "function" &&
    typeof module.consumeCompletedTimers === "function"
  );
}

export class TimerTriggerLimitError extends Error {
  constructor() {
    super(
      "The maximum number of Android timer notifications is already scheduled.",
    );
    this.name = "TimerTriggerLimitError";
  }
}

export class TimerNotificationsDisabledError extends Error {
  constructor() {
    super("Timer notifications are disabled.");
    this.name = "TimerNotificationsDisabledError";
  }
}

function enqueueTimerStateUpdate<T>(operation: () => Promise<T>): Promise<T> {
  const result = timerStateQueue.then(operation, operation);
  timerStateQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function enqueueTimerNotificationOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const result = timerNotificationQueue.then(operation, operation);
  timerNotificationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function recordCompletedTimer(timerId: string): Promise<void> {
  try {
    const storedCompletions = await AsyncStorage.getItem(
      STORAGE_KEYS.TIMER_COMPLETIONS,
    );
    const completions: unknown =
      storedCompletions == null ? [] : JSON.parse(storedCompletions);
    const timerIds = Array.isArray(completions)
      ? completions.filter((id): id is string => typeof id === "string")
      : [];
    if (!timerIds.includes(timerId)) timerIds.push(timerId);
    await AsyncStorage.setItem(
      STORAGE_KEYS.TIMER_COMPLETIONS,
      JSON.stringify(timerIds),
    );
  } catch {
    return;
  }
}

export async function consumeCompletedTimerIds(): Promise<string[]> {
  return enqueueTimerStateUpdate(async () => {
    const module = nativeTimerModule();
    const nativeCompleted = nativeTimerDeliveryAvailable(module)
      ? await module.consumeCompletedTimers()
      : [];
    const nativeTimerIds = Array.isArray(nativeCompleted)
      ? nativeCompleted.filter((id): id is string => typeof id === "string")
      : [];
    try {
      const storedCompletions = await AsyncStorage.getItem(
        STORAGE_KEYS.TIMER_COMPLETIONS,
      );
      if (storedCompletions == null) return nativeTimerIds;

      const completions: unknown = JSON.parse(storedCompletions);
      const timerIds = Array.isArray(completions)
        ? completions.filter((id): id is string => typeof id === "string")
        : [];
      await AsyncStorage.removeItem(STORAGE_KEYS.TIMER_COMPLETIONS);
      return [...new Set([...nativeTimerIds, ...timerIds])];
    } catch {
      return nativeTimerIds;
    }
  });
}

export async function completeTimerFromNotification(
  timerId: string | undefined,
): Promise<void> {
  if (typeof timerId !== "string") return;
  return enqueueTimerStateUpdate(async () => {
    let didComplete = false;
    await getDefaultStore().set(timersAtom, (timers) => {
      const completedTimers = completeTimers(timers, [timerId]);
      didComplete = completedTimers.some(
        (timer, index) => timer !== timers[index],
      );
      return didComplete ? completedTimers : timers;
    });
    if (didComplete) {
      await recordCompletedTimer(timerId);
    }
  });
}

export async function showTimerCompleteNotification(
  label: string,
): Promise<void> {
  await notifee.displayNotification({
    title: label || "Timer",
    body: "Timer complete",
    ...(Platform.OS === "android"
      ? {
          android: {
            channelId: TIMER_CHANNEL_ID,
            sound: "default",
            vibrationPattern: [300, 500],
            autoCancel: true,
          },
        }
      : {
          ios: {
            sound: "default",
            foregroundPresentationOptions: {
              badge: true,
              banner: true,
              list: true,
              sound: true,
            },
          },
        }),
  });
}

export async function scheduleTimerTrigger(timer: {
  id: string;
  label: string;
  durationMs: number;
  startedAt: number;
  pausedElapsedMs: number;
}): Promise<void> {
  return enqueueTimerNotificationOperation(async () => {
    const remainingMs = timer.durationMs - timer.pausedElapsedMs;
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) return;
    const module = nativeTimerModule();
    if (nativeTimerDeliveryAvailable(module)) {
      await module.scheduleTimer(timer.id, timer.label, remainingMs);
      return;
    }
    if (!(await getAlarmDeliveryStatus()).notificationsEnabled) {
      throw new TimerNotificationsDisabledError();
    }
    const completionTime =
      timer.startedAt + timer.durationMs - timer.pausedElapsedMs;
    if (completionTime <= Date.now()) return;

    const notificationId = `timer-${timer.id}`;
    if (Platform.OS === "android") {
      const triggerIds = await notifee.getTriggerNotificationIds();
      if (
        !triggerIds.includes(notificationId) &&
        triggerIds.length >= ANDROID_TIMER_TRIGGER_LIMIT
      ) {
        throw new TimerTriggerLimitError();
      }
    }

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: completionTime,
      alarmManager: { allowWhileIdle: true },
    };

    await notifee.createTriggerNotification(
      {
        id: notificationId,
        data: { timerId: timer.id },
        title: timer.label || "Timer",
        body: "Timer complete",
        ...(Platform.OS === "android"
          ? {
              android: {
                channelId: TIMER_CHANNEL_ID,
                sound: "default",
                vibrationPattern: [300, 500],
                autoCancel: true,
                pressAction: { id: "default" },
              },
            }
          : {
              ios: {
                sound: "default",
                foregroundPresentationOptions: {
                  badge: true,
                  banner: true,
                  list: true,
                  sound: true,
                },
              },
            }),
      },
      trigger,
    );
  });
}

export async function cancelTimerTrigger(timerId: string): Promise<void> {
  return enqueueTimerNotificationOperation(async () => {
    const module = nativeTimerModule();
    if (nativeTimerDeliveryAvailable(module)) {
      await module.cancelTimer(timerId);
      await Promise.allSettled([
        notifee.cancelTriggerNotification(`timer-${timerId}`),
        typeof notifee.cancelNotification === "function"
          ? notifee.cancelNotification(`timer-${timerId}`)
          : Promise.resolve(),
      ]);
      return;
    }
    await notifee.cancelTriggerNotification(`timer-${timerId}`);
    if (typeof notifee.cancelNotification === "function") {
      await notifee.cancelNotification(`timer-${timerId}`);
    }
  });
}

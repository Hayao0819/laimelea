import notifee, {
  type TimestampTrigger,
  TriggerType,
} from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { TIMER_CHANNEL_ID } from "../../../core/notifications/notifeeSetup";
import { STORAGE_KEYS } from "../../../core/storage/keys";
import type { TimerState } from "../../../models/Timer";
import { completeTimers } from "./timerState";

let timerStateQueue: Promise<void> = Promise.resolve();
let timerNotificationQueue: Promise<void> = Promise.resolve();

export const ANDROID_TIMER_TRIGGER_LIMIT = 50;

export class TimerTriggerLimitError extends Error {
  constructor() {
    super(
      "The maximum number of Android timer notifications is already scheduled.",
    );
    this.name = "TimerTriggerLimitError";
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

async function readPersistedTimers(): Promise<TimerState[] | null> {
  const storedTimers = await AsyncStorage.getItem(STORAGE_KEYS.TIMER_STATE);
  if (storedTimers == null) return null;

  try {
    const timers: unknown = JSON.parse(storedTimers);
    return Array.isArray(timers) ? (timers as TimerState[]) : null;
  } catch {
    return null;
  }
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
    try {
      const storedCompletions = await AsyncStorage.getItem(
        STORAGE_KEYS.TIMER_COMPLETIONS,
      );
      if (storedCompletions == null) return [];

      const completions: unknown = JSON.parse(storedCompletions);
      const timerIds = Array.isArray(completions)
        ? completions.filter((id): id is string => typeof id === "string")
        : [];
      await AsyncStorage.removeItem(STORAGE_KEYS.TIMER_COMPLETIONS);
      return timerIds;
    } catch {
      return [];
    }
  });
}

export async function completeTimerFromNotification(
  timerId: string | undefined,
): Promise<void> {
  if (typeof timerId !== "string") return;
  return enqueueTimerStateUpdate(async () => {
    const timers = await readPersistedTimers();
    if (timers == null) return;
    const completedTimers = completeTimers(timers, [timerId]);

    if (completedTimers.some((timer, index) => timer !== timers[index])) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.TIMER_STATE,
        JSON.stringify(completedTimers),
      );
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
    await notifee.cancelTriggerNotification(`timer-${timerId}`);
  });
}

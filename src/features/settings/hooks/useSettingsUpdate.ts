import { useAtom } from "jotai";
import { useCallback, useMemo } from "react";

import { settingsAtom } from "../../../atoms/settingsAtoms";
import type { CycleConfig } from "../../../models/CustomTime";
import type { AppSettings, WidgetSettings } from "../../../models/Settings";
import {
  DEFAULT_ALARM_DEFAULTS,
  DEFAULT_SETTINGS,
  DEFAULT_WIDGET_SETTINGS,
} from "../../../models/Settings";
import { requestClockWidgetUpdate } from "../../widget/services/widgetUpdater";

function updateStoredSettings(
  current: AppSettings | Promise<AppSettings>,
  update: (settings: AppSettings) => AppSettings,
): AppSettings | Promise<AppSettings> {
  return current instanceof Promise ? current.then(update) : update(current);
}

export function useSettingsUpdate() {
  const [rawSettings, setSettings] = useAtom(settingsAtom);
  const settings: AppSettings = useMemo(
    () => ({
      ...DEFAULT_SETTINGS,
      ...rawSettings,
      cycleConfig: {
        ...DEFAULT_SETTINGS.cycleConfig,
        ...rawSettings?.cycleConfig,
      },
      alarmDefaults: {
        ...DEFAULT_SETTINGS.alarmDefaults,
        ...rawSettings?.alarmDefaults,
      },
      widgetSettings: {
        ...DEFAULT_WIDGET_SETTINGS,
        ...rawSettings?.widgetSettings,
      },
    }),
    [rawSettings],
  );

  const update = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings((current) =>
        updateStoredSettings(current, (stored) => ({
          ...DEFAULT_SETTINGS,
          ...stored,
          ...partial,
        })),
      );
    },
    [setSettings],
  );

  const updateAlarmDefaults = useCallback(
    (partial: Partial<AppSettings["alarmDefaults"]>) => {
      setSettings((current) =>
        updateStoredSettings(current, (stored) => ({
          ...DEFAULT_SETTINGS,
          ...stored,
          alarmDefaults: {
            ...DEFAULT_ALARM_DEFAULTS,
            ...stored.alarmDefaults,
            ...partial,
          },
        })),
      );
    },
    [setSettings],
  );

  const updateCycleConfig = useCallback(
    (partial: Partial<CycleConfig>) => {
      setSettings((current) =>
        updateStoredSettings(current, (stored) => ({
          ...DEFAULT_SETTINGS,
          ...stored,
          cycleConfig: {
            ...DEFAULT_SETTINGS.cycleConfig,
            ...stored.cycleConfig,
            ...partial,
          },
        })),
      );
    },
    [setSettings],
  );

  const updateWidgetSettings = useCallback(
    (partial: Partial<WidgetSettings>) => {
      setSettings((current) =>
        updateStoredSettings(current, (stored) => ({
          ...DEFAULT_SETTINGS,
          ...stored,
          widgetSettings: {
            ...DEFAULT_WIDGET_SETTINGS,
            ...stored.widgetSettings,
            ...partial,
          },
        })),
      );
      requestClockWidgetUpdate();
    },
    [setSettings],
  );

  return {
    settings,
    setSettings,
    update,
    updateCycleConfig,
    updateAlarmDefaults,
    updateWidgetSettings,
  };
}

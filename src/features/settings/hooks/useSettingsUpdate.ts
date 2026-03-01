import { useCallback, useMemo } from "react";
import { useAtom } from "jotai";
import { settingsAtom } from "../../../atoms/settingsAtoms";
import type { AppSettings, WidgetSettings } from "../../../models/Settings";
import {
  DEFAULT_SETTINGS,
  DEFAULT_WIDGET_SETTINGS,
} from "../../../models/Settings";
import { requestClockWidgetUpdate } from "../../widget/services/widgetUpdater";

export function useSettingsUpdate() {
  const [rawSettings, setSettings] = useAtom(settingsAtom);
  const settings: AppSettings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...rawSettings }),
    [rawSettings],
  );

  const update = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings({ ...settings, ...partial });
    },
    [settings, setSettings],
  );

  const updateAlarmDefaults = useCallback(
    (partial: Partial<AppSettings["alarmDefaults"]>) => {
      setSettings({
        ...settings,
        alarmDefaults: { ...settings.alarmDefaults, ...partial },
      });
    },
    [settings, setSettings],
  );

  const updateWidgetSettings = useCallback(
    (partial: Partial<WidgetSettings>) => {
      const current = settings.widgetSettings ?? DEFAULT_WIDGET_SETTINGS;
      update({ widgetSettings: { ...current, ...partial } });
      requestClockWidgetUpdate();
    },
    [settings.widgetSettings, update],
  );

  return {
    settings,
    setSettings,
    update,
    updateAlarmDefaults,
    updateWidgetSettings,
  };
}

import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Checkbox,
  Divider,
  IconButton,
  List,
  SegmentedButtons,
  Snackbar,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import { spacing } from "../../../app/spacing";
import { settingsAtom } from "../../../atoms/settingsAtoms";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { sleepSessionsAtom } from "../../../atoms/sleepAtoms";
import { calendarListAtom } from "../../../atoms/calendarAtoms";
import { platformServicesAtom } from "../../../atoms/platformAtoms";
import { requestClockWidgetUpdate } from "../../widget/services/widgetUpdater";
import { TimezonePickerSheet } from "../components/TimezonePickerSheet";
import { resolveLanguage } from "../../../core/i18n";
import { createAccountManager } from "../../../core/account/accountManager";
import type { DismissalMethod, WidgetSettings } from "../../../models/Settings";
import { DEFAULT_WIDGET_SETTINGS } from "../../../models/Settings";

const accountManager = createAccountManager();

const GRADUAL_VOLUME_OPTIONS = [0, 15, 30, 60];
const SNOOZE_DURATION_OPTIONS = [1, 3, 5, 10, 15];
const SNOOZE_MAX_OPTIONS = [1, 2, 3, 5, 10];
const REMINDER_OPTIONS = [0, 5, 10, 15, 30, 60];

const dayMap = { "0": 0, "1": 1, "6": 6 } as const;

export function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [settings, setSettings] = useAtom(settingsAtom);
  const alarms = useAtomValue(alarmsAtom);
  const setAlarms = useSetAtom(alarmsAtom);
  const sleepSessions = useAtomValue(sleepSessionsAtom);
  const setSleepSessions = useSetAtom(sleepSessionsAtom);
  const calendars = useAtomValue(calendarListAtom);
  const platformServices = useAtomValue(platformServicesAtom);

  const [tzPickerVisible, setTzPickerVisible] = useState(false);
  const [tzPickerTarget, setTzPickerTarget] = useState<"primary" | "secondary">(
    "primary",
  );
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const showSnackbar = useCallback((message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  }, []);

  const update = useCallback(
    (partial: Partial<typeof settings>) => {
      setSettings({ ...settings, ...partial });
    },
    [settings, setSettings],
  );

  const updateAlarmDefaults = useCallback(
    (partial: Partial<typeof settings.alarmDefaults>) => {
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

  const widgetSettings = settings.widgetSettings ?? DEFAULT_WIDGET_SETTINGS;

  const isValidHex = useCallback((value: string): boolean => {
    return /^#[0-9A-Fa-f]{6}$/.test(value);
  }, []);

  const handleColorBlur = useCallback(
    (field: keyof WidgetSettings, value: string) => {
      if (!isValidHex(value)) {
        updateWidgetSettings({
          [field]: DEFAULT_WIDGET_SETTINGS[field],
        });
      }
    },
    [isValidHex, updateWidgetSettings],
  );

  const handleOpacityChange = useCallback(
    (text: string) => {
      const num = parseInt(text, 10);
      if (isNaN(num)) {
        updateWidgetSettings({ opacity: 0 });
        return;
      }
      const clamped = Math.max(0, Math.min(100, num));
      updateWidgetSettings({ opacity: clamped });
    },
    [updateWidgetSettings],
  );

  const cycleHours = Math.floor(settings.cycleConfig.cycleLengthMinutes / 60);
  const cycleMinutes = settings.cycleConfig.cycleLengthMinutes % 60;

  const handleCycleHoursChange = useCallback(
    (text: string) => {
      const h = parseInt(text, 10) || 0;
      update({
        cycleConfig: {
          ...settings.cycleConfig,
          cycleLengthMinutes: h * 60 + cycleMinutes,
        },
      });
      requestClockWidgetUpdate();
    },
    [settings.cycleConfig, cycleMinutes, update],
  );

  const handleCycleMinutesChange = useCallback(
    (text: string) => {
      const m = parseInt(text, 10) || 0;
      update({
        cycleConfig: {
          ...settings.cycleConfig,
          cycleLengthMinutes: cycleHours * 60 + m,
        },
      });
      requestClockWidgetUpdate();
    },
    [settings.cycleConfig, cycleHours, update],
  );

  const handleUseCurrentTime = useCallback(() => {
    update({
      cycleConfig: {
        ...settings.cycleConfig,
        baseTimeMs: Date.now(),
      },
    });
    requestClockWidgetUpdate();
  }, [settings.cycleConfig, update]);

  const handleAddAccount = useCallback(async () => {
    try {
      const account = await accountManager.addAccount();
      const currentAccounts = settings.accounts;
      const exists = currentAccounts.some((a) => a.email === account.email);
      const updatedAccounts = exists
        ? currentAccounts.map((a) => (a.email === account.email ? account : a))
        : [...currentAccounts, account];
      update({ accounts: updatedAccounts });
      showSnackbar(t("settings.accountAdded", { email: account.email }));
    } catch {
      showSnackbar(t("settings.accountAddFailed"));
    }
  }, [settings.accounts, update, showSnackbar, t]);

  const handleRemoveAccount = useCallback(
    async (email: string) => {
      await accountManager.removeAccount(email);
      const updatedAccounts = settings.accounts.filter(
        (a) => a.email !== email,
      );
      const partialUpdate: Partial<typeof settings> = {
        accounts: updatedAccounts,
      };
      if (settings.accountEmail === email) {
        partialUpdate.accountEmail = null;
      }
      update(partialUpdate);
      showSnackbar(t("settings.accountRemoved"));
    },
    [settings.accounts, settings.accountEmail, update, showSnackbar, t],
  );

  const handleRemoveLegacyAccount = useCallback(() => {
    update({ accountEmail: null });
    showSnackbar(t("settings.accountRemoved"));
  }, [update, showSnackbar, t]);

  const handleBackup = useCallback(async () => {
    try {
      const data = JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        settings,
        alarms,
        sleepSessions,
      });
      await platformServices.backup.backup(data);
      const now = Date.now();
      update({ lastBackupTimestamp: now });
      showSnackbar(t("settings.backupSuccess"));
    } catch {
      showSnackbar(t("settings.backupFailed"));
    }
  }, [
    settings,
    alarms,
    sleepSessions,
    platformServices.backup,
    update,
    showSnackbar,
    t,
  ]);

  const handleRestore = useCallback(async () => {
    try {
      const raw = await platformServices.backup.restore();
      if (raw == null) {
        showSnackbar(t("settings.noBackupFound"));
        return;
      }
      const data = JSON.parse(raw);
      if (data.version !== 1) {
        showSnackbar(t("settings.backupVersionError"));
        return;
      }
      if (data.settings) setSettings(data.settings);
      if (data.alarms) setAlarms(data.alarms);
      if (data.sleepSessions) setSleepSessions(data.sleepSessions);
      showSnackbar(t("settings.restoreSuccess"));
    } catch {
      showSnackbar(t("settings.restoreFailed"));
    }
  }, [
    platformServices.backup,
    setSettings,
    setAlarms,
    setSleepSessions,
    showSnackbar,
    t,
  ]);

  const handleTzOpen = useCallback((target: "primary" | "secondary") => {
    setTzPickerTarget(target);
    setTzPickerVisible(true);
  }, []);

  const handleTzSelect = useCallback(
    (tz: string) => {
      if (tzPickerTarget === "primary") {
        update({ timezone: tz });
      } else {
        update({ secondaryTimezone: tz });
      }
      setTzPickerVisible(false);
    },
    [tzPickerTarget, update],
  );

  const toggleCalendarVisibility = useCallback(
    (calId: string) => {
      const current = settings.visibleCalendarIds;
      const next = current.includes(calId)
        ? current.filter((id) => id !== calId)
        : [...current, calId];
      update({ visibleCalendarIds: next });
    },
    [settings.visibleCalendarIds, update],
  );

  const cycleNext = useCallback(<T,>(options: T[], current: T): T => {
    const idx = options.indexOf(current);
    return options[(idx + 1) % options.length];
  }, []);

  const renderChevron = useCallback(
    (props: { color: string; style?: object }) => (
      <List.Icon {...props} icon="chevron-right" />
    ),
    [],
  );

  const renderVibrationSwitch = useCallback(
    () => (
      <Switch
        value={settings.alarmDefaults.vibrationEnabled}
        onValueChange={(v) => updateAlarmDefaults({ vibrationEnabled: v })}
        testID="vibration-switch"
      />
    ),
    [settings.alarmDefaults.vibrationEnabled, updateAlarmDefaults],
  );

  const hasLegacyAccount =
    settings.accountEmail != null && settings.accounts.length === 0;

  const renderBorderRadiusSwitch = useCallback(
    () => (
      <Switch
        value={widgetSettings.borderRadius > 0}
        onValueChange={(v) =>
          updateWidgetSettings({ borderRadius: v ? 16 : 0 })
        }
        testID="widget-border-radius-switch"
      />
    ),
    [widgetSettings.borderRadius, updateWidgetSettings],
  );

  const renderShowRealTimeSwitch = useCallback(
    () => (
      <Switch
        value={widgetSettings.showRealTime}
        onValueChange={(v) => updateWidgetSettings({ showRealTime: v })}
        testID="widget-show-real-time-switch"
      />
    ),
    [widgetSettings.showRealTime, updateWidgetSettings],
  );

  const renderShowNextAlarmSwitch = useCallback(
    () => (
      <Switch
        value={widgetSettings.showNextAlarm}
        onValueChange={(v) => updateWidgetSettings({ showNextAlarm: v })}
        testID="widget-show-next-alarm-switch"
      />
    ),
    [widgetSettings.showNextAlarm, updateWidgetSettings],
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      testID="settings-screen"
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section 1: Cycle Config */}
        <List.Section>
          <List.Subheader>{t("settings.cycleConfig")}</List.Subheader>
          <View style={styles.row}>
            <TextInput
              mode="outlined"
              label={t("settings.cycleLengthHours")}
              value={String(cycleHours)}
              onChangeText={handleCycleHoursChange}
              keyboardType="numeric"
              style={styles.input}
              testID="cycle-hours-input"
            />
            <TextInput
              mode="outlined"
              label={t("settings.cycleLengthMinutes")}
              value={String(cycleMinutes)}
              onChangeText={handleCycleMinutesChange}
              keyboardType="numeric"
              style={styles.input}
              testID="cycle-minutes-input"
            />
          </View>
          <Text variant="bodySmall" style={styles.warning}>
            {t("settings.cycleChangeWarning")}
          </Text>
          <List.Item
            title={t("settings.baseTime")}
            description={
              settings.cycleConfig.baseTimeMs > 0
                ? format(
                    new Date(settings.cycleConfig.baseTimeMs),
                    "yyyy-MM-dd HH:mm:ss",
                  )
                : t("common.notSet")
            }
            testID="base-time-item"
          />
          <Button
            mode="outlined"
            onPress={handleUseCurrentTime}
            style={styles.sectionButton}
            testID="use-current-time-button"
          >
            {t("settings.useCurrentTime")}
          </Button>
        </List.Section>

        <Divider />

        {/* Section 2: General */}
        <List.Section>
          <List.Subheader>{t("settings.general")}</List.Subheader>
          <View
            style={styles.segmentContainer}
            testID="primary-display-segment"
          >
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.primaryDisplay")}
            </Text>
            <Text variant="bodySmall" style={styles.segmentDescription}>
              {t("settings.primaryDisplayDescription")}
            </Text>
            <SegmentedButtons<"custom" | "24h">
              value={settings.primaryTimeDisplay}
              onValueChange={(v) => update({ primaryTimeDisplay: v })}
              buttons={[
                { value: "custom", label: t("settings.custom") },
                { value: "24h", label: t("settings.standard24h") },
              ]}
            />
          </View>
          <View style={styles.segmentContainer} testID="language-segment">
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.language")}
            </Text>
            <SegmentedButtons
              value={resolveLanguage(settings.language)}
              onValueChange={(v) => update({ language: v })}
              buttons={[
                { value: "en", label: t("settings.english") },
                { value: "ja", label: t("settings.japanese") },
              ]}
            />
          </View>
          <View style={styles.segmentContainer} testID="theme-segment">
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.theme")}
            </Text>
            <SegmentedButtons<"light" | "dark" | "system">
              value={settings.theme}
              onValueChange={(v) => update({ theme: v })}
              buttons={[
                { value: "light", label: t("settings.themeLight") },
                { value: "dark", label: t("settings.themeDark") },
                { value: "system", label: t("settings.themeSystem") },
              ]}
            />
          </View>
          <View style={styles.segmentContainer} testID="time-format-segment">
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.timeFormat")}
            </Text>
            <SegmentedButtons<"12h" | "24h">
              value={settings.timeFormat}
              onValueChange={(v) => update({ timeFormat: v })}
              buttons={[
                { value: "12h", label: "12h" },
                { value: "24h", label: "24h" },
              ]}
            />
          </View>
        </List.Section>

        <Divider />

        {/* Section 3: Timezone */}
        <List.Section>
          <List.Subheader>{t("settings.timezone")}</List.Subheader>
          <List.Item
            title={t("settings.timezoneLabel")}
            description={settings.timezone}
            onPress={() => handleTzOpen("primary")}
            right={renderChevron}
            testID="timezone-item"
          />
          <View style={styles.segmentContainer} testID="dst-segment">
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.dst")}
            </Text>
            <SegmentedButtons<"auto" | "ignore">
              value={settings.dstHandling}
              onValueChange={(v) => update({ dstHandling: v })}
              buttons={[
                { value: "auto", label: t("settings.dstAuto") },
                { value: "ignore", label: t("settings.dstIgnore") },
              ]}
            />
          </View>
          <List.Item
            title={t("settings.secondaryTz")}
            description={settings.secondaryTimezone ?? t("common.notSet")}
            onPress={() => handleTzOpen("secondary")}
            right={renderChevron}
            testID="secondary-tz-item"
          />
        </List.Section>

        <Divider />

        {/* Section 4: Alarm Defaults */}
        <List.Section>
          <List.Subheader>{t("settings.alarmDefaults")}</List.Subheader>
          <View style={styles.segmentContainer} testID="dismissal-segment">
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.dismissalMethod")}
            </Text>
            <SegmentedButtons<DismissalMethod>
              value={settings.alarmDefaults.dismissalMethod}
              onValueChange={(v) => updateAlarmDefaults({ dismissalMethod: v })}
              buttons={[
                { value: "simple", label: "Simple" },
                { value: "shake", label: "Shake" },
                { value: "math", label: "Math" },
              ]}
            />
          </View>
          <List.Item
            title={t("settings.gradualVolume")}
            description={t("settings.gradualVolumeSec", {
              sec: settings.alarmDefaults.gradualVolumeDurationSec,
            })}
            onPress={() =>
              updateAlarmDefaults({
                gradualVolumeDurationSec: cycleNext(
                  GRADUAL_VOLUME_OPTIONS,
                  settings.alarmDefaults.gradualVolumeDurationSec,
                ),
              })
            }
            testID="gradual-volume-item"
          />
          <List.Item
            title={t("settings.snoozeDuration")}
            description={`${settings.alarmDefaults.snoozeDurationMin} min`}
            onPress={() =>
              updateAlarmDefaults({
                snoozeDurationMin: cycleNext(
                  SNOOZE_DURATION_OPTIONS,
                  settings.alarmDefaults.snoozeDurationMin,
                ),
              })
            }
            testID="snooze-duration-item"
          />
          <List.Item
            title={t("settings.snoozeMaxCount")}
            description={`${settings.alarmDefaults.snoozeMaxCount}`}
            onPress={() =>
              updateAlarmDefaults({
                snoozeMaxCount: cycleNext(
                  SNOOZE_MAX_OPTIONS,
                  settings.alarmDefaults.snoozeMaxCount,
                ),
              })
            }
            testID="snooze-max-item"
          />
          <List.Item
            title={t("settings.vibration")}
            right={renderVibrationSwitch}
            testID="vibration-item"
          />
          <View style={styles.segmentContainer} testID="volume-button-segment">
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.volumeButton")}
            </Text>
            <SegmentedButtons<"snooze" | "dismiss" | "volume">
              value={settings.alarmDefaults.volumeButtonBehavior}
              onValueChange={(v) =>
                updateAlarmDefaults({ volumeButtonBehavior: v })
              }
              buttons={[
                {
                  value: "snooze",
                  label: t("settings.volumeButtonSnooze"),
                },
                {
                  value: "dismiss",
                  label: t("settings.volumeButtonDismiss"),
                },
                {
                  value: "volume",
                  label: t("settings.volumeButtonVolume"),
                },
              ]}
            />
          </View>
        </List.Section>

        <Divider />

        {/* Section 5: Calendar */}
        <List.Section>
          <List.Subheader>{t("settings.calendarSection")}</List.Subheader>
          <List.Subheader>{t("settings.account")}</List.Subheader>
          {hasLegacyAccount && (
            <List.Item
              title={settings.accountEmail!}
              description={t("settings.legacyAccount")}
              right={() => (
                <IconButton
                  icon="close"
                  onPress={handleRemoveLegacyAccount}
                  testID="remove-legacy-account-button"
                  accessibilityLabel={t("settings.removeAccount")}
                />
              )}
              testID="legacy-account-item"
            />
          )}
          {settings.accounts.map((account) => (
            <List.Item
              key={account.email}
              title={account.email}
              right={() => (
                <IconButton
                  icon="close"
                  onPress={() => handleRemoveAccount(account.email)}
                  testID={`remove-account-${account.email}`}
                  accessibilityLabel={t("settings.removeAccount")}
                />
              )}
              testID={`account-item-${account.email}`}
            />
          ))}
          <Button
            mode="outlined"
            onPress={handleAddAccount}
            style={styles.sectionButton}
            testID="add-account-button"
            icon="plus"
          >
            {t("settings.addAccount")}
          </Button>
          <View style={styles.segmentContainer} testID="first-day-segment">
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.firstDayOfWeek")}
            </Text>
            <SegmentedButtons<"0" | "1" | "6">
              value={`${settings.calendarFirstDayOfWeek}`}
              onValueChange={(v) =>
                update({ calendarFirstDayOfWeek: dayMap[v] })
              }
              buttons={[
                { value: "0", label: t("settings.sunday") },
                { value: "1", label: t("settings.monday") },
                { value: "6", label: t("settings.saturday") },
              ]}
            />
          </View>
          <List.Item
            title={t("settings.defaultReminder")}
            description={t("settings.reminderMin", {
              min: settings.defaultEventReminderMin,
            })}
            onPress={() =>
              update({
                defaultEventReminderMin: cycleNext(
                  REMINDER_OPTIONS,
                  settings.defaultEventReminderMin,
                ),
              })
            }
            testID="default-reminder-item"
          />
          <List.Subheader>{t("settings.visibleCalendars")}</List.Subheader>
          {calendars.length === 0 ? (
            <List.Item
              title={t("settings.noCalendars")}
              testID="no-calendars-item"
            />
          ) : (
            calendars.map((cal) => (
              <Checkbox.Item
                key={cal.id}
                label={cal.name}
                status={
                  settings.visibleCalendarIds.includes(cal.id)
                    ? "checked"
                    : "unchecked"
                }
                onPress={() => toggleCalendarVisibility(cal.id)}
                testID={`calendar-checkbox-${cal.id}`}
              />
            ))
          )}
        </List.Section>

        <Divider />

        {/* Section 6: Widget */}
        <List.Section>
          <List.Subheader>{t("settings.widget")}</List.Subheader>
          <View style={styles.colorRow}>
            <View
              style={[
                styles.colorPreview,
                { backgroundColor: widgetSettings.backgroundColor },
              ]}
              testID="widget-bg-color-preview"
            />
            <TextInput
              label={t("settings.widgetBackgroundColor")}
              value={widgetSettings.backgroundColor}
              onChangeText={(text) =>
                updateWidgetSettings({ backgroundColor: text })
              }
              onBlur={() =>
                handleColorBlur(
                  "backgroundColor",
                  widgetSettings.backgroundColor,
                )
              }
              style={styles.colorInput}
              mode="outlined"
              testID="widget-bg-color-input"
            />
          </View>
          <View style={styles.colorRow}>
            <View
              style={[
                styles.colorPreview,
                { backgroundColor: widgetSettings.textColor },
              ]}
              testID="widget-text-color-preview"
            />
            <TextInput
              label={t("settings.widgetTextColor")}
              value={widgetSettings.textColor}
              onChangeText={(text) => updateWidgetSettings({ textColor: text })}
              onBlur={() =>
                handleColorBlur("textColor", widgetSettings.textColor)
              }
              style={styles.colorInput}
              mode="outlined"
              testID="widget-text-color-input"
            />
          </View>
          <View style={styles.colorRow}>
            <View
              style={[
                styles.colorPreview,
                { backgroundColor: widgetSettings.secondaryTextColor },
              ]}
              testID="widget-secondary-color-preview"
            />
            <TextInput
              label={t("settings.widgetSecondaryTextColor")}
              value={widgetSettings.secondaryTextColor}
              onChangeText={(text) =>
                updateWidgetSettings({ secondaryTextColor: text })
              }
              onBlur={() =>
                handleColorBlur(
                  "secondaryTextColor",
                  widgetSettings.secondaryTextColor,
                )
              }
              style={styles.colorInput}
              mode="outlined"
              testID="widget-secondary-color-input"
            />
          </View>
          <View style={styles.colorRow}>
            <View
              style={[
                styles.colorPreview,
                { backgroundColor: widgetSettings.accentColor },
              ]}
              testID="widget-accent-color-preview"
            />
            <TextInput
              label={t("settings.widgetAccentColor")}
              value={widgetSettings.accentColor}
              onChangeText={(text) =>
                updateWidgetSettings({ accentColor: text })
              }
              onBlur={() =>
                handleColorBlur("accentColor", widgetSettings.accentColor)
              }
              style={styles.colorInput}
              mode="outlined"
              testID="widget-accent-color-input"
            />
          </View>
          <View style={styles.colorRow}>
            <TextInput
              label={t("settings.widgetOpacity")}
              value={String(widgetSettings.opacity)}
              onChangeText={handleOpacityChange}
              keyboardType="numeric"
              style={styles.colorInput}
              mode="outlined"
              testID="widget-opacity-input"
            />
          </View>
          <List.Item
            title={t("settings.widgetBorderRadius")}
            right={renderBorderRadiusSwitch}
            testID="widget-border-radius-item"
          />
          <List.Item
            title={t("settings.widgetShowRealTime")}
            right={renderShowRealTimeSwitch}
            testID="widget-show-real-time-item"
          />
          <List.Item
            title={t("settings.widgetShowNextAlarm")}
            right={renderShowNextAlarmSwitch}
            testID="widget-show-next-alarm-item"
          />
        </List.Section>

        <Divider />

        {/* Section 7: Backup */}
        <List.Section>
          <List.Subheader>{t("settings.backup")}</List.Subheader>
          <View style={styles.backupButtons}>
            <Button
              mode="contained"
              onPress={handleBackup}
              style={styles.backupButton}
              testID="backup-now-button"
            >
              {t("settings.backupNow")}
            </Button>
            <Button
              mode="outlined"
              onPress={handleRestore}
              style={styles.backupButton}
              testID="restore-button"
            >
              {t("settings.restore")}
            </Button>
          </View>
          <List.Item
            title={t("settings.lastBackup")}
            description={
              settings.lastBackupTimestamp
                ? format(
                    new Date(settings.lastBackupTimestamp),
                    "yyyy-MM-dd HH:mm",
                  )
                : t("settings.neverBacked")
            }
            testID="last-backup-item"
          />
        </List.Section>
      </ScrollView>

      <TimezonePickerSheet
        visible={tzPickerVisible}
        onDismiss={() => setTzPickerVisible(false)}
        onSelect={handleTzSelect}
        selectedTz={
          tzPickerTarget === "primary"
            ? settings.timezone
            : settings.secondaryTimezone
        }
      />

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        testID="settings-snackbar"
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    marginTop: spacing.sm,
  },
  input: {
    flex: 1,
  },
  warning: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.xs,
    opacity: 0.7,
  },
  segmentContainer: {
    paddingHorizontal: spacing.base,
    marginVertical: spacing.sm,
  },
  segmentLabel: {
    marginBottom: spacing.sm,
  },
  segmentDescription: {
    marginBottom: spacing.sm,
    opacity: 0.7,
  },
  sectionButton: {
    alignSelf: "flex-start",
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: "#555",
  },
  colorInput: {
    flex: 1,
  },
  backupButtons: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  backupButton: {
    flex: 1,
  },
});

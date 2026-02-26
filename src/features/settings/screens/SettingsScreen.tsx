import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Checkbox,
  Divider,
  List,
  SegmentedButtons,
  Snackbar,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import { settingsAtom } from "../../../atoms/settingsAtoms";
import { calendarListAtom } from "../../../atoms/calendarAtoms";
import { platformServicesAtom } from "../../../atoms/platformAtoms";
import { TimezonePickerSheet } from "../components/TimezonePickerSheet";
import type { DismissalMethod } from "../../../models/Settings";

const GRADUAL_VOLUME_OPTIONS = [0, 15, 30, 60];
const SNOOZE_DURATION_OPTIONS = [1, 3, 5, 10, 15];
const SNOOZE_MAX_OPTIONS = [1, 2, 3, 5, 10];
const REMINDER_OPTIONS = [0, 5, 10, 15, 30, 60];

export function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [settings, setSettings] = useAtom(settingsAtom);
  const calendars = useAtomValue(calendarListAtom);
  const platformServices = useAtomValue(platformServicesAtom);

  const [tzPickerVisible, setTzPickerVisible] = useState(false);
  const [tzPickerTarget, setTzPickerTarget] = useState<
    "primary" | "secondary"
  >("primary");
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
  }, [settings.cycleConfig, update]);

  const handleSignIn = useCallback(async () => {
    try {
      const result = await platformServices.auth.signIn();
      update({ accountEmail: result.email });
    } catch {
      showSnackbar("Sign in failed");
    }
  }, [platformServices.auth, update, showSnackbar]);

  const handleSignOut = useCallback(async () => {
    try {
      await platformServices.auth.signOut();
      update({ accountEmail: null });
    } catch {
      showSnackbar("Sign out failed");
    }
  }, [platformServices.auth, update, showSnackbar]);

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

  const cycleNext = useCallback(
    <T,>(options: T[], current: T): T => {
      const idx = options.indexOf(current);
      return options[(idx + 1) % options.length];
    },
    [],
  );

  const renderChevron = useCallback(
    (props: { color: string; style: object }) => (
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

  const renderAccountAction = useCallback(
    () =>
      settings.accountEmail ? (
        <Button mode="text" onPress={handleSignOut} testID="sign-out-button">
          {t("settings.signOut")}
        </Button>
      ) : (
        <Button mode="text" onPress={handleSignIn} testID="sign-in-button">
          {t("calendar.signIn")}
        </Button>
      ),
    [settings.accountEmail, handleSignOut, handleSignIn, t],
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
          <View style={styles.segmentContainer}>
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.primaryDisplay")}
            </Text>
            <SegmentedButtons
              value={settings.primaryTimeDisplay}
              onValueChange={(v) =>
                update({ primaryTimeDisplay: v as "custom" | "24h" })
              }
              buttons={[
                { value: "custom", label: t("settings.custom") },
                { value: "24h", label: t("settings.standard24h") },
              ]}
              testID="primary-display-segment"
            />
          </View>
        </List.Section>

        <Divider />

        {/* Section 2: General */}
        <List.Section>
          <List.Subheader>{t("settings.general")}</List.Subheader>
          <View style={styles.segmentContainer}>
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.language")}
            </Text>
            <SegmentedButtons
              value={settings.language === "ja" ? "ja" : "en"}
              onValueChange={(v) => update({ language: v })}
              buttons={[
                { value: "en", label: t("settings.english") },
                { value: "ja", label: t("settings.japanese") },
              ]}
              testID="language-segment"
            />
          </View>
          <View style={styles.segmentContainer}>
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.theme")}
            </Text>
            <SegmentedButtons
              value={settings.theme}
              onValueChange={(v) =>
                update({ theme: v as "light" | "dark" | "system" })
              }
              buttons={[
                { value: "light", label: t("settings.themeLight") },
                { value: "dark", label: t("settings.themeDark") },
                { value: "system", label: t("settings.themeSystem") },
              ]}
              testID="theme-segment"
            />
          </View>
          <View style={styles.segmentContainer}>
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.timeFormat")}
            </Text>
            <SegmentedButtons
              value={settings.timeFormat}
              onValueChange={(v) =>
                update({ timeFormat: v as "12h" | "24h" })
              }
              buttons={[
                { value: "12h", label: "12h" },
                { value: "24h", label: "24h" },
              ]}
              testID="time-format-segment"
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
          <View style={styles.segmentContainer}>
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.dst")}
            </Text>
            <SegmentedButtons
              value={settings.dstHandling}
              onValueChange={(v) =>
                update({ dstHandling: v as "auto" | "ignore" })
              }
              buttons={[
                { value: "auto", label: t("settings.dstAuto") },
                { value: "ignore", label: t("settings.dstIgnore") },
              ]}
              testID="dst-segment"
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
          <View style={styles.segmentContainer}>
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.dismissalMethod")}
            </Text>
            <SegmentedButtons
              value={settings.alarmDefaults.dismissalMethod}
              onValueChange={(v) =>
                updateAlarmDefaults({
                  dismissalMethod: v as DismissalMethod,
                })
              }
              buttons={[
                { value: "simple", label: "Simple" },
                { value: "shake", label: "Shake" },
                { value: "math", label: "Math" },
              ]}
              testID="dismissal-segment"
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
          <View style={styles.segmentContainer}>
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.volumeButton")}
            </Text>
            <SegmentedButtons
              value={settings.alarmDefaults.volumeButtonBehavior}
              onValueChange={(v) =>
                updateAlarmDefaults({
                  volumeButtonBehavior: v as
                    | "snooze"
                    | "dismiss"
                    | "volume",
                })
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
              testID="volume-button-segment"
            />
          </View>
        </List.Section>

        <Divider />

        {/* Section 5: Calendar */}
        <List.Section>
          <List.Subheader>{t("settings.calendarSection")}</List.Subheader>
          <List.Item
            title={t("settings.account")}
            description={
              settings.accountEmail ?? t("settings.notSignedIn")
            }
            right={renderAccountAction}
            testID="account-item"
          />
          <View style={styles.segmentContainer}>
            <Text variant="bodyMedium" style={styles.segmentLabel}>
              {t("settings.firstDayOfWeek")}
            </Text>
            <SegmentedButtons
              value={String(settings.calendarFirstDayOfWeek)}
              onValueChange={(v) =>
                update({
                  calendarFirstDayOfWeek: Number(v) as 0 | 1 | 6,
                })
              }
              buttons={[
                { value: "0", label: t("settings.sunday") },
                { value: "1", label: t("settings.monday") },
                { value: "6", label: t("settings.saturday") },
              ]}
              testID="first-day-segment"
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

        {/* Section 6: Backup */}
        <List.Section>
          <List.Subheader>{t("settings.backup")}</List.Subheader>
          <View style={styles.backupButtons}>
            <Button
              mode="contained"
              onPress={() => showSnackbar(t("settings.backupNotAvailable"))}
              style={styles.backupButton}
              testID="backup-now-button"
            >
              {t("settings.backupNow")}
            </Button>
            <Button
              mode="outlined"
              onPress={() => showSnackbar(t("settings.backupNotAvailable"))}
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
    paddingBottom: 32,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  input: {
    flex: 1,
  },
  warning: {
    paddingHorizontal: 16,
    marginTop: 4,
    opacity: 0.7,
  },
  segmentContainer: {
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  segmentLabel: {
    marginBottom: 8,
  },
  sectionButton: {
    alignSelf: "flex-start",
    marginHorizontal: 16,
    marginTop: 8,
  },
  backupButtons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  backupButton: {
    flex: 1,
  },
});

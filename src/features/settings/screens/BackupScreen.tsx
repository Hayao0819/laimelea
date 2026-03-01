import React, { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, List, Snackbar } from "react-native-paper";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import { spacing } from "../../../app/spacing";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { sleepSessionsAtom } from "../../../atoms/sleepAtoms";
import { platformServicesAtom } from "../../../atoms/platformAtoms";
import { useSettingsUpdate } from "../hooks/useSettingsUpdate";
import { useSnackbar } from "../hooks/useSnackbar";

export function BackupScreen() {
  const { t } = useTranslation();
  const { settings, update, setSettings } = useSettingsUpdate();
  const alarms = useAtomValue(alarmsAtom);
  const setAlarms = useSetAtom(alarmsAtom);
  const sleepSessions = useAtomValue(sleepSessionsAtom);
  const setSleepSessions = useSetAtom(sleepSessionsAtom);
  const platformServices = useAtomValue(platformServicesAtom);
  const {
    visible: snackbarVisible,
    message: snackbarMessage,
    show: showSnackbar,
    dismiss: dismissSnackbar,
  } = useSnackbar();

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

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        testID="backup-screen"
      >
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

      <Snackbar
        visible={snackbarVisible}
        onDismiss={dismissSnackbar}
        duration={3000}
        testID="backup-snackbar"
      >
        {snackbarMessage}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
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

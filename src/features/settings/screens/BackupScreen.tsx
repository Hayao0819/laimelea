import { format } from "date-fns";
import { useAtomValue, useSetAtom } from "jotai";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, List, Snackbar } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import { alarmsAtom } from "../../../atoms/alarmAtoms";
import { platformServicesAtom } from "../../../atoms/platformAtoms";
import { sleepSessionsAtom } from "../../../atoms/sleepAtoms";
import {
  game2048StoreAtom,
  resolvedStoreAtom,
} from "../../game2048/atoms/game2048Atoms";
import { useSettingsUpdate } from "../hooks/useSettingsUpdate";
import { useSnackbar } from "../hooks/useSnackbar";

export function BackupScreen() {
  const { t } = useTranslation();
  const { settings, update, setSettings } = useSettingsUpdate();
  const alarms = useAtomValue(alarmsAtom);
  const setAlarms = useSetAtom(alarmsAtom);
  const sleepSessions = useAtomValue(sleepSessionsAtom);
  const setSleepSessions = useSetAtom(sleepSessionsAtom);
  const game2048Store = useAtomValue(resolvedStoreAtom);
  const setGame2048Store = useSetAtom(game2048StoreAtom);
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
        game2048: game2048Store,
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
    game2048Store,
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
      if (data.game2048) setGame2048Store(data.game2048);
      showSnackbar(t("settings.restoreSuccess"));
    } catch {
      showSnackbar(t("settings.restoreFailed"));
    }
  }, [
    platformServices.backup,
    setSettings,
    setAlarms,
    setSleepSessions,
    setGame2048Store,
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

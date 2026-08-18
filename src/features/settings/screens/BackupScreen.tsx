import { format } from "date-fns";
import { useAtomValue, useSetAtom } from "jotai";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, List, Snackbar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import { parseBackupData } from "../services/backupData";
import {
  restoreBackupTransaction,
  type RestoreSnapshot,
  waitForRestoreWrites,
} from "../services/restoreTransaction";

export function BackupScreen() {
  const { t } = useTranslation();
  const { settings, update, setSettings } = useSettingsUpdate();
  const insets = useSafeAreaInsets();
  const alarms = useAtomValue(alarmsAtom);
  const setAlarms = useSetAtom(alarmsAtom);
  const sleepSessions = useAtomValue(sleepSessionsAtom);
  const setSleepSessions = useSetAtom(sleepSessionsAtom);
  const game2048Store = useAtomValue(resolvedStoreAtom);
  const setGame2048Store = useSetAtom(game2048StoreAtom);
  const platformServices = useAtomValue(platformServicesAtom);
  const [remoteBackupTimestamp, setRemoteBackupTimestamp] = useState<
    number | null
  >(null);
  const operationInFlight = useRef(false);
  const [operation, setOperation] = useState<"backup" | "restore" | null>(null);
  const {
    visible: snackbarVisible,
    message: snackbarMessage,
    show: showSnackbar,
    dismiss: dismissSnackbar,
  } = useSnackbar();

  useEffect(() => {
    let active = true;
    const loadBackupTimestamp = async () => {
      try {
        if (!(await platformServices.backup.isAvailable())) return;
        const timestamp = await platformServices.backup.getLastBackupTime();
        if (active) setRemoteBackupTimestamp(timestamp);
      } catch {
        if (active) setRemoteBackupTimestamp(null);
      }
    };
    loadBackupTimestamp();
    return () => {
      active = false;
    };
  }, [platformServices.backup]);

  const handleBackup = useCallback(async () => {
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setOperation("backup");
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
      setRemoteBackupTimestamp(now);
      showSnackbar(t("settings.backupSuccess"));
    } catch {
      showSnackbar(t("settings.backupFailed"));
    } finally {
      operationInFlight.current = false;
      setOperation(null);
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
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setOperation("restore");
    try {
      const raw = await platformServices.backup.restore();
      if (raw == null) {
        showSnackbar(t("settings.noBackupFound"));
        return;
      }
      const data = parseBackupData(raw);
      if (data == null) {
        showSnackbar(t("settings.backupVersionError"));
        return;
      }
      const currentSnapshot: RestoreSnapshot = {
        settings,
        alarms,
        sleepSessions,
        game2048: game2048Store,
      };
      const restoredSnapshot: RestoreSnapshot = {
        settings: data.settings,
        alarms: data.alarms,
        sleepSessions: data.sleepSessions,
        game2048: data.game2048,
      };
      await restoreBackupTransaction(
        currentSnapshot,
        restoredSnapshot,
        async (snapshot) => {
          await waitForRestoreWrites([
            Promise.resolve(setSettings(snapshot.settings)),
            Promise.resolve(setAlarms(snapshot.alarms)),
            Promise.resolve(setSleepSessions(snapshot.sleepSessions)),
            Promise.resolve(setGame2048Store(snapshot.game2048)),
          ]);
        },
      );
      showSnackbar(t("settings.restoreSuccess"));
    } catch {
      showSnackbar(t("settings.restoreFailed"));
    } finally {
      operationInFlight.current = false;
      setOperation(null);
    }
  }, [
    platformServices.backup,
    alarms,
    settings,
    sleepSessions,
    game2048Store,
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
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom: spacing.xl + insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        testID="backup-screen"
      >
        <List.Section>
          <List.Subheader>{t("settings.backup")}</List.Subheader>
          <View style={styles.backupButtons}>
            <Button
              mode="contained"
              onPress={handleBackup}
              disabled={operation !== null}
              style={styles.backupButton}
              testID="backup-now-button"
            >
              {t("settings.backupNow")}
            </Button>
            <Button
              mode="outlined"
              onPress={handleRestore}
              disabled={operation !== null}
              style={styles.backupButton}
              testID="restore-button"
            >
              {t("settings.restore")}
            </Button>
          </View>
          <List.Item
            title={t("settings.lastBackup")}
            description={
              Math.max(
                settings.lastBackupTimestamp ?? Number.NEGATIVE_INFINITY,
                remoteBackupTimestamp ?? Number.NEGATIVE_INFINITY,
              ) > Number.NEGATIVE_INFINITY
                ? format(
                    new Date(
                      Math.max(
                        settings.lastBackupTimestamp ??
                          Number.NEGATIVE_INFINITY,
                        remoteBackupTimestamp ?? Number.NEGATIVE_INFINITY,
                      ),
                    ),
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

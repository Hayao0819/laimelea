import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Icon, Surface, Text, TextInput } from "react-native-paper";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import { spacing, radius } from "../../../app/spacing";
import { settingsAtom } from "../../../atoms/settingsAtoms";
import { DEFAULT_SETTINGS } from "../../../models/Settings";
import { realToCustom } from "../../../core/time/conversions";
import {
  formatCustomDay,
  formatCustomTime,
} from "../../../core/time/formatting";
import { DEFAULT_CYCLE_LENGTH_MINUTES } from "../../../core/time/constants";
import { createAccountManager } from "../../../core/account/accountManager";
import type { Account } from "../../../core/account/types";

const accountManager = createAccountManager();

const DEFAULT_HOURS = Math.floor(DEFAULT_CYCLE_LENGTH_MINUTES / 60);
const DEFAULT_MINUTES = DEFAULT_CYCLE_LENGTH_MINUTES % 60;

export function SetupScreen() {
  const setSettings = useSetAtom(settingsAtom);
  const { t } = useTranslation();

  const [hours, setHours] = useState(String(DEFAULT_HOURS));
  const [minutes, setMinutes] = useState(String(DEFAULT_MINUTES));
  const [baseTimeMs, setBaseTimeMs] = useState<number | null>(null);
  const [addedAccounts, setAddedAccounts] = useState<Account[]>([]);
  const [signingIn, setSigningIn] = useState(false);

  const cycleLengthMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  const isValid = cycleLengthMinutes > 0 && baseTimeMs !== null;

  const preview = useMemo(() => {
    if (!isValid) return null;
    const config = { cycleLengthMinutes, baseTimeMs: baseTimeMs! };
    const now = Date.now();
    const custom = realToCustom(now, config);
    return `${formatCustomDay(custom)}  ${formatCustomTime(custom)}`;
  }, [cycleLengthMinutes, baseTimeMs, isValid]);

  const handleUseNow = useCallback(() => {
    setBaseTimeMs(Date.now());
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setSigningIn(true);
    try {
      const account = await accountManager.addAccount();
      setAddedAccounts((prev) => {
        const exists = prev.some((a) => a.email === account.email);
        return exists
          ? prev.map((a) => (a.email === account.email ? account : a))
          : [...prev, account];
      });
    } catch {
      // User cancelled or auth failed - sign in is optional
    } finally {
      setSigningIn(false);
    }
  }, []);

  const handleDone = useCallback(() => {
    if (!isValid) return;
    setSettings((prev) => ({
      ...DEFAULT_SETTINGS,
      ...(typeof prev === "object" && prev !== null && !("then" in prev)
        ? prev
        : {}),
      cycleConfig: {
        cycleLengthMinutes,
        baseTimeMs: baseTimeMs!,
      },
      accounts: addedAccounts,
      setupComplete: true,
    }));
  }, [isValid, cycleLengthMinutes, baseTimeMs, addedAccounts, setSettings]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        variant="headlineMedium"
        style={styles.title}
        accessibilityRole="header"
      >
        {t("setup.welcome")}
      </Text>
      <Text variant="bodyLarge" style={styles.description}>
        {t("setup.description")}
      </Text>

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" accessibilityRole="header">
          {t("setup.setCycleLength")}
        </Text>
        <View style={styles.row}>
          <TextInput
            mode="outlined"
            label={t("setup.hours")}
            value={hours}
            onChangeText={setHours}
            keyboardType="numeric"
            style={styles.input}
            testID="cycle-hours"
          />
          <TextInput
            mode="outlined"
            label={t("setup.minutes")}
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="numeric"
            style={styles.input}
            testID="cycle-minutes"
          />
        </View>
      </Surface>

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" accessibilityRole="header">
          {t("setup.setBaseTime")}
        </Text>
        <Text variant="bodySmall" style={styles.hint}>
          {t("setup.baseTimeDescription")}
        </Text>
        <Button
          mode="outlined"
          onPress={handleUseNow}
          style={styles.button}
          accessibilityLabel={t("setup.useNow")}
        >
          {t("setup.useNow")}
        </Button>
        {baseTimeMs !== null && (
          <Text variant="bodyLarge" style={styles.baseTimeDisplay}>
            {format(new Date(baseTimeMs), "yyyy-MM-dd HH:mm:ss")}
          </Text>
        )}
      </Surface>

      {preview && (
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleMedium" accessibilityRole="header">
            {t("setup.preview")}
          </Text>
          <Text variant="headlineSmall" style={styles.previewText}>
            {preview}
          </Text>
        </Surface>
      )}

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium" accessibilityRole="header">
          {t("setup.googleAccount")}
        </Text>
        <Text variant="bodySmall" style={styles.hint}>
          {t("setup.googleAccountDescription")}
        </Text>
        <Button
          mode="outlined"
          onPress={handleGoogleSignIn}
          loading={signingIn}
          disabled={signingIn}
          style={styles.button}
          testID="google-sign-in-button"
          accessibilityLabel={t("setup.signInWithGoogle")}
          icon="google"
        >
          {t("setup.signInWithGoogle")}
        </Button>
        {addedAccounts.map((account) => (
          <View
            key={account.email}
            style={styles.accountRow}
            testID={`added-account-${account.email}`}
          >
            <Icon source="check-circle" size={18} color="#4caf50" />
            <Text variant="bodyMedium" style={styles.accountEmail}>
              {account.email}
            </Text>
          </View>
        ))}
      </Surface>

      <Button
        mode="contained"
        onPress={handleDone}
        disabled={!isValid}
        style={styles.doneButton}
        testID="done-button"
        accessibilityLabel={t("setup.done")}
      >
        {t("setup.done")}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.base,
    paddingTop: 64,
  },
  title: {
    marginBottom: spacing.sm,
  },
  description: {
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.base,
    borderRadius: radius.md,
    marginBottom: spacing.base,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  input: {
    flex: 1,
  },
  hint: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  button: {
    alignSelf: "flex-start",
  },
  baseTimeDisplay: {
    marginTop: spacing.md,
  },
  previewText: {
    marginTop: spacing.sm,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  accountEmail: {
    flex: 1,
  },
  doneButton: {
    marginTop: spacing.sm,
  },
});

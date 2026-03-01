import React, { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Checkbox,
  IconButton,
  List,
  SegmentedButtons,
  Snackbar,
  Text,
} from "react-native-paper";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";

import { spacing } from "../../../app/spacing";
import { calendarListAtom } from "../../../atoms/calendarAtoms";
import { useSettingsUpdate } from "../hooks/useSettingsUpdate";
import { useSnackbar } from "../hooks/useSnackbar";
import { createAccountManager } from "../../../core/account/accountManager";

const accountManager = createAccountManager();

const REMINDER_OPTIONS = [0, 5, 10, 15, 30, 60];

const dayMap = { "0": 0, "1": 1, "6": 6 } as const;

function cycleNext<T>(options: T[], current: T): T {
  const idx = options.indexOf(current);
  return options[(idx + 1) % options.length];
}

export function CalendarSettingsScreen() {
  const { t } = useTranslation();
  const { settings, update } = useSettingsUpdate();
  const calendars = useAtomValue(calendarListAtom);
  const { visible: snackbarVisible, message: snackbarMessage, show: showSnackbar, dismiss: dismissSnackbar } = useSnackbar();

  const hasLegacyAccount =
    settings.accountEmail != null && settings.accounts.length === 0;

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

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        testID="calendar-settings-screen"
      >
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
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={dismissSnackbar}
        duration={3000}
        testID="calendar-settings-snackbar"
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
  segmentContainer: {
    paddingHorizontal: spacing.base,
    marginVertical: spacing.sm,
  },
  segmentLabel: {
    marginBottom: spacing.sm,
  },
  sectionButton: {
    alignSelf: "flex-start",
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
  },
});

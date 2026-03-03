import { useAtomValue } from "jotai";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Checkbox,
  List,
  SegmentedButtons,
  Snackbar,
  Text,
} from "react-native-paper";

import { spacing } from "../../../app/spacing";
import { calendarListAtom } from "../../../atoms/calendarAtoms";
import { useSettingsUpdate } from "../hooks/useSettingsUpdate";
import { useSnackbar } from "../hooks/useSnackbar";

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
  const {
    visible: snackbarVisible,
    message: snackbarMessage,
    dismiss: dismissSnackbar,
  } = useSnackbar();

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
});

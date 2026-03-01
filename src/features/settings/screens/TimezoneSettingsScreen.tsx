import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { List, SegmentedButtons, Text } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { spacing } from "../../../app/spacing";
import { useSettingsUpdate } from "../hooks/useSettingsUpdate";
import { TimezonePickerSheet } from "../components/TimezonePickerSheet";

export function TimezoneSettingsScreen() {
  const { t } = useTranslation();
  const { settings, update } = useSettingsUpdate();

  const [tzPickerVisible, setTzPickerVisible] = useState(false);
  const [tzPickerTarget, setTzPickerTarget] = useState<"primary" | "secondary">(
    "primary",
  );

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

  const renderChevron = useCallback(
    (props: { color: string; style?: object }) => (
      <List.Icon {...props} icon="chevron-right" />
    ),
    [],
  );

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        testID="timezone-settings-screen"
      >
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

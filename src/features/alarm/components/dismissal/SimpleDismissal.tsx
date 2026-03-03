import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet,View } from "react-native";
import { Button } from "react-native-paper";

import { spacing } from "../../../../app/spacing";
import type { DismissalComponentProps } from "../../strategies/types";

export function SimpleDismissal({
  onDismiss,
  onSnooze,
  canSnooze,
}: DismissalComponentProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container} testID="dismissal-simple">
      {canSnooze && (
        <Button
          mode="outlined"
          onPress={onSnooze}
          style={styles.button}
          testID="snooze-button"
          accessibilityLabel={t("alarm.snoozeAction")}
        >
          {t("alarm.snoozeAction")}
        </Button>
      )}
      <Button
        mode="contained"
        onPress={onDismiss}
        style={styles.button}
        testID="dismiss-button"
        accessibilityLabel={t("dismissal.simple")}
      >
        {t("dismissal.simple")}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacing.base,
  },
  button: {
    minWidth: 120,
  },
});

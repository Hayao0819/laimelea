import React from "react";
import { View, StyleSheet } from "react-native";
import { Button } from "react-native-paper";
import { useTranslation } from "react-i18next";
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
        >
          {t("alarm.snoozeAction")}
        </Button>
      )}
      <Button
        mode="contained"
        onPress={onDismiss}
        style={styles.button}
        testID="dismiss-button"
      >
        {t("dismissal.simple")}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 16,
  },
  button: {
    minWidth: 120,
  },
});

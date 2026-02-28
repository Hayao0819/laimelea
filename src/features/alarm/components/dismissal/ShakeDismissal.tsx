import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Button, ProgressBar, Text } from "react-native-paper";
import { spacing } from "../../../../app/spacing";
import { useTranslation } from "react-i18next";
import RNShake from "react-native-shake";
import type { DismissalComponentProps } from "../../strategies/types";

const REQUIRED_SHAKES = 3;

export function ShakeDismissal({
  onDismiss,
  onSnooze,
  canSnooze,
}: DismissalComponentProps) {
  const { t } = useTranslation();
  const [shakeCount, setShakeCount] = useState(0);

  useEffect(() => {
    const subscription = RNShake.addListener(() => {
      setShakeCount((prev) => {
        const next = prev + 1;
        if (next >= REQUIRED_SHAKES) {
          onDismiss();
        }
        return next;
      });
    });
    return () => {
      subscription.remove();
    };
  }, [onDismiss]);

  const progress = Math.min(shakeCount / REQUIRED_SHAKES, 1);

  return (
    <View style={styles.container} testID="dismissal-shake">
      <Text variant="headlineSmall" style={styles.instruction}>
        {t("dismissal.shakeInstruction")}
      </Text>
      <ProgressBar
        progress={progress}
        style={styles.progressBar}
        testID="shake-progress"
        accessibilityLabel={t("dismissal.shakeCount", {
          current: shakeCount,
          total: REQUIRED_SHAKES,
        })}
        accessibilityRole="progressbar"
      />
      <Text variant="bodyLarge" testID="shake-count">
        {t("dismissal.shakeCount", {
          current: shakeCount,
          total: REQUIRED_SHAKES,
        })}
      </Text>
      {canSnooze && (
        <Button
          mode="outlined"
          onPress={onSnooze}
          style={styles.snoozeButton}
          testID="snooze-button"
          accessibilityLabel={t("alarm.snoozeAction")}
        >
          {t("alarm.snoozeAction")}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.base,
    width: "100%",
    paddingHorizontal: spacing.xl,
  },
  instruction: {
    textAlign: "center",
  },
  progressBar: {
    width: "100%",
    height: 8,
    borderRadius: 4,
  },
  snoozeButton: {
    marginTop: spacing.base,
    minWidth: 120,
  },
});

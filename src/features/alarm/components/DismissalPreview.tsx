import { useNavigation } from "@react-navigation/native";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { Button } from "react-native-paper";

import type { Alarm } from "../../../models/Alarm";

interface DismissalPreviewProps {
  alarm: Partial<Alarm> & { dismissalMethod: Alarm["dismissalMethod"] };
}

export function DismissalPreview({ alarm }: DismissalPreviewProps) {
  const { t } = useTranslation();
  const navigation = useNavigation();

  const handlePress = useCallback(() => {
    // Navigate to AlarmFiring in preview mode.
    // The isPreview and alarm params will be added by alarm-firing-enhance worker.
    (navigation.navigate as (...args: unknown[]) => void)(
      "AlarmFiring",
      {
        alarmId: alarm.id ?? "preview",
        isPreview: true,
        alarm,
      },
    );
  }, [navigation, alarm]);

  return (
    <Button
      mode="contained-tonal"
      onPress={handlePress}
      icon="eye"
      style={styles.button}
      testID="preview-button"
      accessibilityLabel={t("alarm.showPreview")}
    >
      {t("alarm.showPreview")}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 0,
  },
});

// Re-export old props type for backwards compatibility in tests
export type { DismissalPreviewProps };

import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";

import { radius, spacing } from "../../../app/spacing";
import type { DismissalMethod } from "../../../models/Settings";
import { getStrategy } from "../strategies";
import { DismissalContainer } from "./dismissal/DismissalContainer";

interface DismissalPreviewProps {
  method: DismissalMethod;
  difficulty: number;
}

export function DismissalPreview({
  method,
  difficulty,
}: DismissalPreviewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const strategy = getStrategy(method);

  if (!strategy) return null;

  return (
    <Surface style={styles.container} elevation={0}>
      <Text
        variant="labelMedium"
        style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
      >
        {t("alarm.dismissalPreview")}
      </Text>
      <View
        style={styles.preview}
        pointerEvents="none"
        accessibilityLabel={t("alarm.dismissalPreviewOf", {
          method: t(strategy.displayName),
        })}
        testID="dismissal-preview"
      >
        <DismissalContainer
          method={method}
          difficulty={difficulty}
          onDismiss={() => {}}
          onSnooze={() => {}}
          canSnooze={true}
        />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    padding: spacing.base,
    overflow: "hidden",
  },
  label: {
    marginBottom: spacing.sm,
  },
  preview: {
    alignItems: "center",
    opacity: 0.8,
    transform: [{ scale: 0.85 }],
  },
});

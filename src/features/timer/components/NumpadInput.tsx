import React, { useCallback,useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, useWindowDimensions,View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { spacing } from "../../../app/spacing";

interface Props {
  onStart: (durationMs: number) => void;
}

const PRESETS = [1, 5, 10, 30];

function digitsToDisplay(digits: string): { h: string; m: string; s: string } {
  const padded = digits.padStart(6, "0");
  return {
    h: padded.slice(0, 2),
    m: padded.slice(2, 4),
    s: padded.slice(4, 6),
  };
}

function digitsToMs(digits: string): number {
  const { h, m, s } = digitsToDisplay(digits);
  return (
    (parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10)) * 1000
  );
}

export function NumpadInput({ onStart }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [digits, setDigits] = useState("");
  const numpadPadding = spacing.base * 2;
  const numpadGap = spacing.sm;
  const buttonWidth = (screenWidth - numpadPadding - numpadGap * 2) / 3;
  const buttonHeight = Math.max(56, buttonWidth * 0.55);

  const handleDigit = useCallback(
    (d: string) => {
      if (digits.length >= 6) return;
      setDigits((prev) => prev + d);
    },
    [digits.length],
  );

  const handleBackspace = useCallback(() => {
    setDigits((prev) => prev.slice(0, -1));
  }, []);

  const handleStart = useCallback(() => {
    const ms = digitsToMs(digits);
    if (ms <= 0) return;
    setDigits("");
    onStart(ms);
  }, [digits, onStart]);

  const handlePreset = useCallback(
    (min: number) => {
      setDigits("");
      onStart(min * 60 * 1000);
    },
    [onStart],
  );

  const { h, m, s } = digitsToDisplay(digits);
  const totalMs = digitsToMs(digits);

  return (
    <View style={styles.container}>
      <View
        style={styles.display}
        accessibilityLabel={`${h}${t("timer.hours")} ${m}${t("timer.minutes")} ${s}${t("timer.seconds")}`}
        accessibilityRole="timer"
      >
        <Text variant="displaySmall" style={styles.displayText}>
          <Text
            style={
              digits.length > 4 ? { color: theme.colors.primary } : undefined
            }
          >
            {h}
          </Text>
          <Text style={styles.separator}>h </Text>
          <Text
            style={
              digits.length > 2 && digits.length <= 4
                ? { color: theme.colors.primary }
                : undefined
            }
          >
            {m}
          </Text>
          <Text style={styles.separator}>m </Text>
          <Text
            style={
              digits.length > 0 && digits.length <= 2
                ? { color: theme.colors.primary }
                : undefined
            }
          >
            {s}
          </Text>
          <Text style={styles.separator}>s</Text>
        </Text>
      </View>

      <View style={styles.numpad}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
          ["", "0", "⌫"],
        ].map((row, ri) => (
          <View key={ri} style={styles.numpadRow}>
            {row.map((key) => {
              const btnStyle = {
                width: buttonWidth,
                height: buttonHeight,
              };
              const btnContentStyle = { height: buttonHeight };
              if (key === "") {
                return <View key="empty" style={btnStyle} />;
              }
              if (key === "⌫") {
                return (
                  <Button
                    key={key}
                    mode="text"
                    onPress={handleBackspace}
                    style={btnStyle}
                    contentStyle={btnContentStyle}
                    labelStyle={styles.numpadLabel}
                    disabled={digits.length === 0}
                    testID="numpad-backspace"
                    accessibilityLabel={t("timer.backspace")}
                  >
                    ⌫
                  </Button>
                );
              }
              return (
                <Button
                  key={key}
                  mode="text"
                  onPress={() => handleDigit(key)}
                  style={btnStyle}
                  contentStyle={btnContentStyle}
                  labelStyle={styles.numpadLabel}
                  disabled={digits.length >= 6}
                  testID={`numpad-${key}`}
                  accessibilityLabel={key}
                >
                  {key}
                </Button>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.presets}>
        {PRESETS.map((min) => (
          <Button
            key={min}
            mode="outlined"
            onPress={() => handlePreset(min)}
            compact
            style={styles.presetButton}
            testID={`preset-${min}`}
            accessibilityLabel={t("timer.presetMin", { min })}
          >
            {t("timer.presetMin", { min })}
          </Button>
        ))}
      </View>

      <Button
        mode="contained"
        onPress={handleStart}
        disabled={totalMs <= 0}
        style={styles.startButton}
        testID="numpad-start"
        accessibilityLabel={t("timer.start")}
      >
        {t("timer.start")}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.base,
  },
  display: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  displayText: {
    fontVariant: ["tabular-nums"],
  },
  separator: {
    opacity: 0.5,
  },
  numpad: {
    gap: spacing.sm,
  },
  numpadRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  numpadLabel: {
    fontSize: 22,
  },
  presets: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.base,
  },
  presetButton: {
    minWidth: 0,
  },
  startButton: {
    marginTop: spacing.base,
    marginHorizontal: spacing.xl,
  },
});

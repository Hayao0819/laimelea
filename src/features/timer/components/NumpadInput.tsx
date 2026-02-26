import React, { useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

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
  const [digits, setDigits] = useState("");

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
      <View style={styles.display}>
        <Text variant="headlineMedium" style={styles.displayText}>
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
              if (key === "") {
                return <View key="empty" style={styles.numpadButton} />;
              }
              if (key === "⌫") {
                return (
                  <Button
                    key={key}
                    mode="text"
                    onPress={handleBackspace}
                    style={styles.numpadButton}
                    contentStyle={styles.numpadContent}
                    disabled={digits.length === 0}
                    testID="numpad-backspace"
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
                  style={styles.numpadButton}
                  contentStyle={styles.numpadContent}
                  disabled={digits.length >= 6}
                  testID={`numpad-${key}`}
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
      >
        {t("timer.start")}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  display: {
    alignItems: "center",
    marginBottom: 8,
  },
  displayText: {
    fontVariant: ["tabular-nums"],
  },
  separator: {
    opacity: 0.5,
  },
  numpad: {
    gap: 4,
  },
  numpadRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  numpadButton: {
    width: 72,
    height: 48,
  },
  numpadContent: {
    height: 48,
  },
  presets: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  presetButton: {
    minWidth: 0,
  },
  startButton: {
    marginTop: 12,
    marginHorizontal: 32,
  },
});

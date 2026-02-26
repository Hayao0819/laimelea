import React, { useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Text, TextInput, HelperText } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { generateMathProblem } from "../../services/mathProblemGenerator";
import type { DismissalComponentProps } from "../../strategies/types";

export function MathDismissal({
  onDismiss,
  onSnooze,
  difficulty,
  canSnooze,
}: DismissalComponentProps) {
  const { t } = useTranslation();
  const [problem, setProblem] = useState(() => generateMathProblem(difficulty));
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = useCallback(() => {
    const parsed = parseInt(input, 10);
    if (parsed === problem.answer) {
      onDismiss();
    } else {
      setError(true);
      setInput("");
      setProblem(generateMathProblem(difficulty));
    }
  }, [input, problem.answer, onDismiss, difficulty]);

  return (
    <View style={styles.container} testID="dismissal-math">
      <Text variant="bodyLarge" style={styles.instruction}>
        {t("dismissal.mathInstruction")}
      </Text>
      <Text
        variant="displaySmall"
        style={styles.question}
        testID="math-question"
      >
        {problem.question} = ?
      </Text>
      <TextInput
        mode="outlined"
        keyboardType="numeric"
        value={input}
        onChangeText={(text) => {
          setInput(text);
          setError(false);
        }}
        style={styles.input}
        testID="math-input"
      />
      {error && (
        <HelperText type="error" visible testID="math-error">
          {t("dismissal.mathWrong")}
        </HelperText>
      )}
      <Button
        mode="contained"
        onPress={handleSubmit}
        style={styles.submitButton}
        testID="math-submit"
      >
        {t("dismissal.mathSubmit")}
      </Button>
      {canSnooze && (
        <Button
          mode="outlined"
          onPress={onSnooze}
          style={styles.snoozeButton}
          testID="snooze-button"
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
    gap: 12,
    width: "100%",
    paddingHorizontal: 32,
  },
  instruction: {
    textAlign: "center",
  },
  question: {
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  input: {
    width: "100%",
    textAlign: "center",
  },
  submitButton: {
    minWidth: 120,
  },
  snoozeButton: {
    marginTop: 8,
    minWidth: 120,
  },
});

import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";

import { spacing } from "../../../../app/spacing";
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
        accessibilityLabel={`${problem.question} = ?`}
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
        accessibilityLabel={t("dismissal.mathInstruction")}
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
        accessibilityLabel={t("dismissal.mathSubmit")}
      >
        {t("dismissal.mathSubmit")}
      </Button>
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
    gap: spacing.md,
    width: "100%",
    paddingHorizontal: spacing.xl,
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
    marginTop: spacing.sm,
    minWidth: 120,
  },
});

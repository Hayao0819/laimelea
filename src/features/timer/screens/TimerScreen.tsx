import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { SegmentedButtons } from "react-native-paper";

import { spacing } from "../../../app/spacing";
import { CountdownTimer } from "../components/CountdownTimer";
import { Stopwatch } from "../components/Stopwatch";

type TimerTab = "countdown" | "stopwatch";

export function TimerScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TimerTab>("countdown");

  return (
    <View style={styles.container} testID="timer-screen">
      <View style={styles.toggle}>
        <SegmentedButtons<TimerTab>
          value={tab}
          onValueChange={(v) => setTab(v)}
          buttons={[
            { value: "countdown", label: t("timer.countdown") },
            { value: "stopwatch", label: t("timer.stopwatch") },
          ]}
        />
      </View>
      {tab === "countdown" ? <CountdownTimer /> : <Stopwatch />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toggle: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
});

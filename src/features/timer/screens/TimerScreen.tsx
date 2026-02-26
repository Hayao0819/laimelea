import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { SegmentedButtons } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { CountdownTimer } from "../components/CountdownTimer";
import { Stopwatch } from "../components/Stopwatch";

type TimerTab = "countdown" | "stopwatch";

export function TimerScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TimerTab>("countdown");

  return (
    <View style={styles.container}>
      <View style={styles.toggle}>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as TimerTab)}
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});

import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

export function ClockScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineLarge">Clock</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

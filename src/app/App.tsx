import React, { Suspense } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { RootNavigator } from "../navigation/RootNavigator";
import { Providers } from "./Providers";

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Providers>
        <RootNavigator />
      </Providers>
    </Suspense>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

module.exports = {
  dependencies: {
    // Android-only: no iOS native code
    "react-native-android-widget": {
      platforms: { ios: null },
    },
    "react-native-health-connect": {
      platforms: { ios: null },
    },
  },
};

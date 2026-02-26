module.exports = {
  preset: "react-native",
  testPathIgnorePatterns: ["/node_modules/", "/__tests__/e2e/"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native(-.*)?|@react-native(-community)?)/)",
  ],
};

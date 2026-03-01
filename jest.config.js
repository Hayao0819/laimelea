module.exports = {
  preset: "react-native",
  testPathIgnorePatterns: ["/node_modules/", "/__tests__/e2e/", "\\.worktree/"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native(-.*)?|@react-native(-community)?)/)",
  ],
  moduleNameMapper: {
    "react-native-config": "<rootDir>/__mocks__/react-native-config.js",
  },
};

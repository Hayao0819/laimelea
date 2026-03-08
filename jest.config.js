module.exports = {
  preset: "react-native",
  testPathIgnorePatterns: ["/node_modules/", "/__tests__/e2e/", "\\.worktree/"],
  modulePathIgnorePatterns: ["<rootDir>/\\.worktree/"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/types.ts",
    "!src/**/__tests__/**",
  ],
  coverageReporters: ["lcov", "text-summary"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native(-.*)?|@react-native(-community)?|@react-navigation|react-native-reanimated|react-native-worklets)/)",
  ],
  moduleNameMapper: {
    "react-native-config": "<rootDir>/__mocks__/react-native-config.js",
    "react-native-reanimated": "<rootDir>/__mocks__/react-native-reanimated.js",
  },
};

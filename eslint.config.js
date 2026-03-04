const reactNativeConfig = require("@react-native/eslint-config/flat");
const simpleImportSort = require("eslint-plugin-simple-import-sort");

module.exports = [
  {
    ignores: [".worktree/**"],
  },
  ...reactNativeConfig,
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "ft-flow/define-flow-type": "off",
      "ft-flow/use-flow-type": "off",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
];

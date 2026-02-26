const reactNativeConfig = require("@react-native/eslint-config/flat");

module.exports = [
  ...reactNativeConfig,
  {
    rules: {
      "ft-flow/define-flow-type": "off",
      "ft-flow/use-flow-type": "off",
    },
  },
];

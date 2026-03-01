const path = require("path");
const {
  default: exclusionList,
} = require("metro-config/private/defaults/exclusionList");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: exclusionList([
      new RegExp(
        `^${escapeRegExp(path.resolve(__dirname, ".worktree"))}[\\\\/].*$`,
      ),
    ]),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

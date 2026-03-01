const { View } = require("react-native");

const Animated = {
  View,
  createAnimatedComponent: (component) => component,
};

const Reanimated = {
  __esModule: true,
  default: Animated,
  useSharedValue: (init) => ({ value: init }),
  useAnimatedStyle: (fn) => fn(),
  withTiming: (toValue) => toValue,
  withSequence: (...values) => values[values.length - 1],
  withDelay: (_delay, value) => value,
  Easing: {
    ease: (t) => t,
    out: () => (t) => t,
    in: () => (t) => t,
    inOut: () => (t) => t,
  },
};

module.exports = Reanimated;

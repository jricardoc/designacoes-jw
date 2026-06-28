module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 54) automatically applies the
    // react-native-worklets/Reanimated plugin when the package is installed.
    presets: ["babel-preset-expo"],
  };
};

module.exports = function (api) {
  api.cache(true);
  const plugins = [];

  try {
    // Only add the reanimated plugin when it's installed and we're not building for web
    const isWeb = process.env.BABEL_ENV === 'web' || process.env.EXPO_TARGET === 'web';
    if (!isWeb) {
      require.resolve('react-native-reanimated/plugin');
      plugins.push('react-native-reanimated/plugin');
    }
  } catch (e) {
    // plugin missing or not resolvable — skip it to avoid build-time crashes (web/CI)
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};

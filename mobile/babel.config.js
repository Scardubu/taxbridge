module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [],
    // ✅ DO NOT add react-native-reanimated/plugin
    // ✅ DO NOT add react-native-worklets/plugin
    // babel-preset-expo auto-injects both for SDK 54 (SDK-04 fix)
    env: {
      production: {
        plugins: ['transform-remove-console'],
      },
    },
  };
};

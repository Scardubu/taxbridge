const path = require('path');

// For npm workspaces, resolve modules from root
const rootNodeModules = path.resolve(__dirname, '../node_modules');

module.exports = {
  rootDir: __dirname,
  roots: ['<rootDir>'],
  testEnvironment: 'jsdom',
  // Define globals before any setup files run
  globals: {
    __DEV__: true,
  },
  setupFilesAfterEnv: [path.join(__dirname, 'jest.setup.js')],
  moduleNameMapper: {
    '^expo-image-picker$': '<rootDir>/__mocks__/expo-image-picker.js',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.js',
    '^react-native-vector-icons$': '@expo/vector-icons',
    '^react-native-vector-icons/(.*)': '@expo/vector-icons/$1',
  },
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', {
      caller: { name: 'metro', bundler: 'metro', platform: 'ios' },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base))',
  ],
  moduleDirectories: ['node_modules', rootNodeModules],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  haste: {
    defaultPlatform: 'ios',
    platforms: ['android', 'ios', 'native'],
  },
};

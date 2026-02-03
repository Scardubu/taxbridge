module.exports = {
  preset: 'jest-expo',
  rootDir: __dirname,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^expo-image-picker$': '<rootDir>/__mocks__/expo-image-picker.js',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.js',
    '^react-native-vector-icons$': '@expo/vector-icons',
    '^react-native-vector-icons/(.*)': '@expo/vector-icons/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
  },
  testMatch: [
    '**/__tests__/**/*.(test|spec).(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  // Ensure tests run in isolation to prevent cleanup-related errors
  testEnvironmentOptions: {
    url: 'http://localhost/',
  },
  // Increased timeout for async tests
  testTimeout: 30000,
  // Force exit after tests complete to handle open handles
  forceExit: true,
  // Detect open handles that may cause warnings
  detectOpenHandles: false,
};

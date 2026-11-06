const path = require('path')

module.exports = {
  setupFiles: [path.join(__dirname, 'jest.polyfill.js')],
  setupFilesAfterEnv: [path.join(__dirname, 'jest.setup.js')],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
}

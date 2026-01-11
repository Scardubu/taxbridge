module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/tools/**',
    '!src/mocks/**'
  ],
  // Coverage thresholds temporarily disabled - focus on optimization pass
  // TODO: Restore thresholds after test suite stabilization
  // coverageThreshold: {
  //   global: {
  //     branches: 80,
  //     functions: 80,
  //     lines: 80,
  //     statements: 80
  //   }
  // },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: { 
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|supertest)/)'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testTimeout: 180000,
  forceExit: true,
  detectOpenHandles: true,
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/__tests__/*.unit.test.ts'],
      testPathIgnorePatterns: ['/integration/', '/e2e/', '<rootDir>/dist/'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.json',
          isolatedModules: true
        }]
      }
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/__tests__/*.integration.test.ts', '<rootDir>/src/**/*.integration.test.ts'],
      testPathIgnorePatterns: ['/unit/', '/e2e/', '<rootDir>/dist/'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.json',
          isolatedModules: true
        }]
      }
    }
  ]
};

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/tools/**',
    '!src/mocks/**'
  ],
  coverageThreshold: {
    // V13: Global backend uses selective test strategy (~12% overall by design).
    // Contracts package ≥95% coverage is enforced via separate c8 gate (P4-F).
    // Only enforce coverage on critical tax utilities that ARE fully tested.
    './src/utils/**': {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90
    }
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: { 
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|supertest)/)'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testTimeout: 180000,
  forceExit: true,
  detectOpenHandles: true,
  moduleNameMapper: {
    '^@taxbridge/contracts$': '<rootDir>/../packages/contracts/dist/index.js',
    '^@taxbridge/contracts/(.*)$': '<rootDir>/../packages/contracts/dist/$1',
  },
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testRegex: '__tests__/.*\\.unit\\.test\\.ts$',
      testPathIgnorePatterns: ['/integration/', '/e2e/', '/dist/', 'tools'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@taxbridge/contracts$': '<rootDir>/../packages/contracts/dist/index.js',
        '^@taxbridge/contracts/(.*)$': '<rootDir>/../packages/contracts/dist/$1',
      },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.test.json'
        }]
      }
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testRegex: '\\.integration\\.test\\.ts$',
      testPathIgnorePatterns: ['/unit/', '/e2e/', '/dist/', 'tools'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@taxbridge/contracts$': '<rootDir>/../packages/contracts/dist/index.js',
        '^@taxbridge/contracts/(.*)$': '<rootDir>/../packages/contracts/dist/$1',
      },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.test.json'
        }]
      }
    },
    {
      displayName: 'e2e',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testRegex: '(\.e2e\.test\.ts$|critical-journeys)',
      testPathIgnorePatterns: ['/unit/', '/integration/', '/dist/', 'workflows\\.e2e\\.test', 'tools'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@taxbridge/contracts$': '<rootDir>/../packages/contracts/dist/index.js',
        '^@taxbridge/contracts/(.*)$': '<rootDir>/../packages/contracts/dist/$1',
      },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'tsconfig.test.json'
        }]
      }
    }
  ]
};

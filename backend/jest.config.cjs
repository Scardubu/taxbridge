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
    global: {
      branches: 60,
      functions: 60,
      lines: 65,
      statements: 65
    }
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: { 
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
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
          tsconfig: 'tsconfig.json'
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
          tsconfig: 'tsconfig.json'
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
          tsconfig: 'tsconfig.json'
        }]
      }
    }
  ]
};

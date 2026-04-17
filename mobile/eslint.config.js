const js = require('@eslint/js');

// ─── Common globals ────────────────────────────────────────────────────────────
const nodeGlobals = {
  module: 'readonly',
  exports: 'writable',
  require: 'readonly',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
};

const jestGlobals = {
  ...nodeGlobals,
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  afterAll: 'readonly',
  afterEach: 'readonly',
  jest: 'readonly',
  global: 'writable',
};

module.exports = [
  // ─── Global ignores ──────────────────────────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'coverage/**',
      'dist/**',
      'App.tsx.bak',
      'src/**',
      '**/*.ts',
      '**/*.tsx',
    ],
  },

  // ─── Base recommended (applies to all JS files) ──────────────────────────────
  js.configs.recommended,

  // ─── Scripts + all Metro/Babel/config JS files (Node.js CJS) ────────────────
  {
    files: [
      'scripts/**/*.js',
      '.github/scripts/**/*.js',
      'metro.config.js',
      'metro.config.*.js',
      'babel.config.js',
      'eslint.config.js',
      '*.config.js',
      'build-android-apk.js',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: nodeGlobals,
    },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-undef': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off',
    },
  },

  // ─── Jest setup + mock files ─────────────────────────────────────────────────
  {
    files: ['jest.setup.js', '__mocks__/**/*.js', '**/__tests__/**/*.js', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: jestGlobals,
    },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-undef': 'error',
      'no-console': 'off',
    },
  },
];

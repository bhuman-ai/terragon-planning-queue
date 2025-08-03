module.exports = {
  extends: ['next'],
  env: {
    node: true,
    jest: true,
    es6: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Sacred Principle Enforcement
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-var': 'error',
    'prefer-const': 'error',
    
    // Security Rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // Code Quality
    'no-duplicate-imports': 'error',
    'no-unreachable': 'error',
    'no-unreachable-loop': 'error',
    'array-callback-return': 'error',
    'consistent-return': 'error',
    
    // Testing Rules
    'jest/no-disabled-tests': 'error',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/valid-expect': 'error'
  },
  overrides: [
    {
      files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
      env: {
        jest: true
      },
      rules: {
        // Allow console in tests for debugging
        'no-console': 'off',
        // Require proper test structure
        'jest/expect-expect': 'error',
        'jest/no-export': 'error'
      }
    },
    {
      files: ['pages/api/**/*'],
      rules: {
        // API routes specific rules
        'no-console': ['error', { allow: ['warn', 'error', 'log'] }], // Allow logging in API routes
      }
    },
    {
      files: ['lib/security/**/*'],
      rules: {
        // Extra security for security modules
        'no-console': ['error', { allow: ['error'] }], // Only errors in security code
        'no-var': 'error',
        'prefer-const': 'error',
        'no-eval': 'error',
        'no-implied-eval': 'error'
      }
    }
  ],
  plugins: ['jest'],
  settings: {
    jest: {
      version: 29
    }
  },
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'coverage/',
    'test-reports/',
    '*.config.js'
  ]
}
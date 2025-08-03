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
    'jest/valid-expect': 'error',
    
    // LLM Code Validation Rules - Objective Binary Testing
    'no-warning-comments': ['error', { 
      'terms': ['TODO', 'FIXME', 'XXX', 'HACK', 'BUG', 'WARNING', 'WARN', 'DEPRECATED'],
      'location': 'anywhere'
    }],
    'no-magic-numbers': ['error', { 
      'ignore': [-1, 0, 1, 2, 100, 200, 404, 500],
      'ignoreArrayIndexes': true,
      'enforceConst': true,
      'detectObjects': false
    }],
    'complexity': ['error', { max: 10 }],
    'max-depth': ['error', { max: 4 }],
    'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
    'max-params': ['error', { max: 4 }],
    'no-nested-ternary': 'error',
    'prefer-destructuring': ['error', {
      'array': true,
      'object': true
    }, {
      'enforceForRenamedProperties': false
    }],
    'prefer-template': 'error',
    'template-curly-spacing': ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'comma-dangle': ['error', 'never'],
    'semi': ['error', 'never'],
    'quotes': ['error', 'single', { 'avoidEscape': true }],
    'indent': ['error', 2, { 'SwitchCase': 1 }],
    'no-trailing-spaces': 'error',
    'eol-last': ['error', 'always'],
    
    // LLM Function Quality Rules
    'require-jsdoc': ['error', {
      'require': {
        'FunctionDeclaration': true,
        'MethodDefinition': true,
        'ClassDeclaration': true,
        'ArrowFunctionExpression': false,
        'FunctionExpression': true
      }
    }],
    'valid-jsdoc': ['error', {
      'prefer': {
        'arg': 'param',
        'argument': 'param',
        'class': 'constructor',
        'return': 'returns',
        'virtual': 'abstract'
      },
      'preferType': {
        'Boolean': 'boolean',
        'Number': 'number',
        'object': 'Object',
        'String': 'string'
      },
      'requireReturn': true,
      'requireReturnType': true,
      'requireParamDescription': true,
      'requireReturnDescription': true
    }],
    
    // LLM Error Handling Validation
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    'no-return-await': 'error',
    'require-await': 'error',
    
    // LLM Async/Await Quality
    'no-async-promise-executor': 'error',
    'no-await-in-loop': 'error',
    'no-promise-executor-return': 'error',
    
    // Custom LLM Validation Rules - TODO: Enable when plugin is properly loaded
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
        'jest/no-export': 'error',
        // Relax LLM rules for tests
        'no-magic-numbers': 'off',
        'max-lines-per-function': ['error', { max: 100 }],
        'require-jsdoc': 'off',
        'valid-jsdoc': 'off',
        'no-warning-comments': 'off'
      }
    },
    {
      files: ['pages/api/**/*'],
      rules: {
        // API routes specific rules
        'no-console': ['error', { allow: ['warn', 'error', 'log'] }], // Allow logging in API routes
        // Stricter LLM validation for API routes
        'complexity': ['error', { max: 8 }],
        'max-params': ['error', { max: 3 }],
        'require-await': 'error'
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
        'no-implied-eval': 'error',
        // Maximum LLM validation for security code
        'complexity': ['error', { max: 6 }],
        'max-depth': ['error', { max: 3 }],
        'max-lines-per-function': ['error', { max: 30 }],
        'max-params': ['error', { max: 3 }],
        'no-warning-comments': 'error',
        'require-jsdoc': 'error',
        'valid-jsdoc': 'error'
      }
    },
    {
      // LLM-generated code specific validation
      files: ['lib/meta-agent/**/*', 'lib/collaboration/**/*'],
      rules: {
        // Enhanced validation for AI-generated modules
        'complexity': ['error', { max: 8 }],
        'max-depth': ['error', { max: 3 }],
        'max-lines-per-function': ['error', { max: 40 }],
        'no-warning-comments': 'error',
        'require-jsdoc': 'error',
        'valid-jsdoc': 'error',
        'no-magic-numbers': ['error', { 
          'ignore': [-1, 0, 1, 2, 5000, 10000],
          'ignoreArrayIndexes': true 
        }]
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
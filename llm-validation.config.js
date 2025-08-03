/**
 * LLM Code Validation Configuration
 * Centralized configuration for objective binary testing
 */

module.exports = {
  // Global validation settings
  global: {
    maxExecutionTime: 100, // ms - for real-time validation
    cacheEnabled: true,
    cacheSize: 1000,
    strictMode: false
  },

  // File patterns to validate
  targets: {
    all: [
      'lib/**/*.js',
      'pages/**/*.js',
      'components/**/*.js'
    ],
    llm: [
      'lib/meta-agent/**/*.js',
      'lib/collaboration/**/*.js'
    ],
    security: [
      'lib/security/**/*.js',
      'pages/api/collaboration/**/*.js'
    ],
    api: [
      'pages/api/**/*.js'
    ],
    tests: [
      '__tests__/**/*.js'
    ]
  },

  // Exclude patterns
  exclude: [
    'node_modules/**',
    '.next/**',
    'coverage/**',
    'test-reports/**',
    '*.config.js',
    'scripts/**' // Don't validate validation scripts
  ],

  // Sacred Principles validation rules
  sacredPrinciples: {
    // Rule 1: NO SIMULATIONS
    noSimulation: {
      enabled: true,
      severity: 'error',
      patterns: [
        /mock\s*\(/gi,
        /simulate\s*\(/gi,
        /fake\s*\(/gi,
        /stub\s*\(/gi,
        /\.mock\./gi,
        /\.fake\./gi,
        /\.simulate\./gi
      ],
      exemptions: ['test', 'spec', '__tests__'],
      message: 'Sacred Principle Violation: No simulations, mocks, or fake functionality allowed'
    },

    // Rule 2: NO FALLBACKS
    noFallbacks: {
      enabled: true,
      severity: 'error',
      patterns: [
        /fallback\s*=/gi,
        /default\s*=.*fallback/gi,
        /\.fallback\(/gi,
        /\|\|\s*fallback/gi
      ],
      message: 'Sacred Principle Violation: No fallbacks allowed - fix the root problem'
    },

    // Rule 3: NO TEMPLATES
    noTemplates: {
      enabled: true,
      severity: 'warning',
      patterns: [
        /template\s*=\s*["'`][^"'`]*{{[^}]*}}[^"'`]*["'`]/gi,
        /templateString\s*=/gi,
        /\.template\(/gi
      ],
      message: 'Sacred Principle Violation: Task decomposition must be 100% AI-driven'
    },

    // Rule 4: NO ASSUMPTIONS
    noAssumptions: {
      enabled: true,
      severity: 'warning',
      patterns: [
        /\/\/\s*assume/gi,
        /\/\/\s*assuming/gi,
        /\/\*.*assume.*\*\//gi
      ],
      message: 'Sacred Principle Violation: Always check CLAUDE.md before making assumptions'
    },

    // Rule 5: ALWAYS REAL
    alwaysReal: {
      enabled: true,
      severity: 'error',
      patterns: [
        /\/\/\s*placeholder/gi,
        /\/\/\s*todo:\s*implement/gi,
        /throw\s+new\s+Error\(['"`]not\s+implemented['"`]\)/gi
      ],
      message: 'Sacred Principle Violation: Every interaction must be genuine and real'
    }
  },

  // LLM-specific code quality rules
  codeQuality: {
    // Function complexity
    functionComplexity: {
      enabled: true,
      maxLines: 50,
      maxCyclomaticComplexity: 10,
      maxParameters: 4,
      maxNestingDepth: 3
    },

    // Error handling
    errorHandling: {
      requireTryCatch: true,
      noEmptyCatch: true,
      requireErrorContext: true,
      noThrowLiteral: true
    },

    // Documentation
    documentation: {
      requireJSDoc: true,
      requireParamDescription: true,
      requireReturnDescription: true,
      requireExamples: false
    },

    // Async/Await patterns
    asyncPatterns: {
      requireErrorHandling: true,
      noAwaitInLoop: true,
      preferAsyncAwait: true
    },

    // Security patterns
    security: {
      noConsoleInProduction: true,
      noEval: true,
      noMagicNumbers: true,
      validateInputs: true
    }
  },

  // File-specific rule overrides
  overrides: {
    // Test files - relaxed rules
    '**/__tests__/**/*': {
      sacredPrinciples: {
        noSimulation: { enabled: false }
      },
      codeQuality: {
        functionComplexity: {
          maxLines: 100
        },
        documentation: {
          requireJSDoc: false
        }
      }
    },

    // Security files - stricter rules
    'lib/security/**/*': {
      codeQuality: {
        functionComplexity: {
          maxLines: 30,
          maxCyclomaticComplexity: 6,
          maxParameters: 3,
          maxNestingDepth: 2
        },
        security: {
          validateInputs: true,
          requireAuditTrail: true
        }
      }
    },

    // API routes - moderate strictness
    'pages/api/**/*': {
      codeQuality: {
        functionComplexity: {
          maxLines: 40,
          maxCyclomaticComplexity: 8
        },
        errorHandling: {
          requireTryCatch: true,
          requireErrorContext: true
        }
      }
    },

    // LLM-generated code - enhanced validation
    'lib/meta-agent/**/*': {
      sacredPrinciples: {
        // All rules enforced strictly
        noSimulation: { severity: 'error' },
        noFallbacks: { severity: 'error' },
        alwaysReal: { severity: 'error' }
      },
      codeQuality: {
        functionComplexity: {
          maxLines: 40,
          maxCyclomaticComplexity: 8
        },
        documentation: {
          requireJSDoc: true,
          requireExamples: true
        }
      }
    }
  },

  // Output formatting options
  output: {
    formats: ['json', 'compact', 'detailed'],
    colors: true,
    timestamps: true,
    showContext: true,
    groupByFile: true,
    showFixSuggestions: true
  },

  // Performance settings
  performance: {
    parallel: true,
    maxWorkers: 2,
    timeout: 100, // ms per file for real-time validation
    batchSize: 10,
    enableProfiling: false
  },

  // Integration settings
  integration: {
    eslint: {
      enabled: true,
      configPath: '.eslintrc.js'
    },
    jest: {
      enabled: true,
      integrationLevel: 'full' // 'basic' | 'full'
    },
    git: {
      preCommitHook: true,
      failOnViolations: true
    },
    ci: {
      enabled: true,
      failBuild: true,
      reportFormat: 'json'
    }
  },

  // Reporting
  reporting: {
    generateReports: true,
    reportDirectory: 'test-reports',
    formats: ['html', 'json', 'junit'],
    includeMetrics: true,
    includeTrends: true
  }
}
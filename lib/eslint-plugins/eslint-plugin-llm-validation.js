/**
 * ESLint Plugin for LLM Code Validation
 * Provides objective binary pass/fail rules for LLM-generated code
 * Enhanced with sacred principles enforcement and security validation
 * 
 * Performance Target: <100ms validation time
 * Security Focus: OWASP Top 10 vulnerability detection
 * Sacred Principles: NO SIMULATIONS, NO FALLBACKS, NO TEMPLATES, ALWAYS REAL
 */

const plugin = {
  meta: {
    name: 'eslint-plugin-llm-validation',
    version: '1.0.0'
  },
  
  rules: {
    /**
     * Rule: no-console-in-production
     * Objective: Binary check for console statements in production code
     */
    'no-console-in-production': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow console statements in production code paths',
          category: 'LLM Code Quality',
          recommended: true
        },
        fixable: 'code',
        schema: [{
          type: 'object',
          properties: {
            allowedMethods: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          additionalProperties: false
        }]
      },
      create(context) {
        const options = context.options[0] || {}
        const allowedMethods = options.allowedMethods || ['error', 'warn']
        
        return {
          MemberExpression(node) {
            if (
              node.object.name === 'console' &&
              node.property.type === 'Identifier' &&
              !allowedMethods.includes(node.property.name)
            ) {
              context.report({
                node,
                message: `Console method '${node.property.name}' not allowed in production code`,
                fix(fixer) {
                  // Suggest replacing with proper logging
                  return fixer.replaceText(node, `// TODO: Replace with proper logging: ${context.getSourceCode().getText(node)}`)
                }
              })
            }
          }
        }
      }
    },

    /**
     * Rule: require-error-context
     * Objective: Binary check for error handling context
     */
    'require-error-context': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require contextual information in error handling',
          category: 'LLM Error Handling',
          recommended: true
        },
        schema: []
      },
      create(context) {
        return {
          CatchClause(node) {
            const body = node.body.body
            
            // Check if catch block is empty or only has basic error handling
            if (body.length === 0) {
              context.report({
                node,
                message: 'Empty catch block detected - must handle error with context'
              })
              return
            }

            // Check for contextual error handling
            const hasContextualHandling = body.some(statement => {
              if (statement.type === 'ExpressionStatement') {
                const expr = statement.expression
                if (expr.type === 'CallExpression') {
                  // Check for console.error, logger calls, or throw with context
                  return (
                    (expr.callee.type === 'MemberExpression' && 
                     expr.callee.object.name === 'console' &&
                     expr.callee.property.name === 'error') ||
                    (expr.callee.name && expr.callee.name.includes('log')) ||
                    (expr.callee.type === 'Identifier' && expr.callee.name === 'throw')
                  )
                }
              }
              return false
            })

            if (!hasContextualHandling) {
              context.report({
                node,
                message: 'Catch block must include contextual error handling (logging or re-throwing with context)'
              })
            }
          }
        }
      }
    },

    /**
     * Rule: require-function-returns
     * Objective: Binary check for explicit return statements
     */
    'require-function-returns': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require explicit return statements in functions',
          category: 'LLM Function Quality',
          recommended: true
        },
        schema: [{
          type: 'object',
          properties: {
            allowImplicitReturns: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          additionalProperties: false
        }]
      },
      create(context) {
        const options = context.options[0] || {}
        const allowImplicitReturns = options.allowImplicitReturns || ['void', 'undefined']
        
        function checkFunction(node) {
          if (node.body.type !== 'BlockStatement') return
          
          const hasExplicitReturn = node.body.body.some(statement => 
            statement.type === 'ReturnStatement'
          )
          
          // Check if function is supposed to return something based on JSDoc
          const comments = context.getSourceCode().getCommentsBefore(node)
          const hasReturnDoc = comments.some(comment => 
            comment.value.includes('@returns') || comment.value.includes('@return')
          )
          
          if (hasReturnDoc && !hasExplicitReturn) {
            context.report({
              node,
              message: 'Function documented to return value must have explicit return statement'
            })
          }
        }
        
        return {
          FunctionDeclaration: checkFunction,
          FunctionExpression: checkFunction,
          ArrowFunctionExpression: checkFunction
        }
      }
    },

    /**
     * Rule: no-deep-nesting
     * Objective: Binary check for excessive nesting depth
     */
    'no-deep-nesting': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow excessive nesting depth in code blocks',
          category: 'LLM Code Complexity',
          recommended: true
        },
        schema: [{
          type: 'object',
          properties: {
            maxDepth: { type: 'integer', minimum: 1 }
          },
          additionalProperties: false
        }]
      },
      create(context) {
        const options = context.options[0] || {}
        const maxDepth = options.maxDepth || 3
        const nestingStack = []
        
        function checkNesting(node) {
          nestingStack.push(node)
          
          if (nestingStack.length > maxDepth) {
            context.report({
              node,
              message: `Block nesting depth of ${nestingStack.length} exceeds maximum allowed depth of ${maxDepth}`
            })
          }
        }
        
        function exitNesting() {
          nestingStack.pop()
        }
        
        return {
          BlockStatement: checkNesting,
          'BlockStatement:exit': exitNesting,
          IfStatement: checkNesting,
          'IfStatement:exit': exitNesting,
          ForStatement: checkNesting,
          'ForStatement:exit': exitNesting,
          WhileStatement: checkNesting,
          'WhileStatement:exit': exitNesting,
          DoWhileStatement: checkNesting,
          'DoWhileStatement:exit': exitNesting,
          SwitchStatement: checkNesting,
          'SwitchStatement:exit': exitNesting
        }
      }
    },

    /**
     * Rule: require-async-error-handling
     * Objective: Binary check for proper async error handling
     */
    'require-async-error-handling': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require proper error handling in async functions',
          category: 'LLM Async Quality',
          recommended: true
        },
        schema: []
      },
      create(context) {
        function checkAsyncFunction(node) {
          if (!node.async) return
          
          const body = node.body
          if (body.type !== 'BlockStatement') return
          
          // Check for try-catch blocks or .catch() calls
          const hasTryCatch = body.body.some(statement => 
            statement.type === 'TryStatement'
          )
          
          // Check for await calls without error handling
          const awaitCalls = []
          
          function findAwaitCalls(node) {
            if (node.type === 'AwaitExpression') {
              awaitCalls.push(node)
            }
            
            for (const key in node) {
              if (node[key] && typeof node[key] === 'object') {
                if (Array.isArray(node[key])) {
                  node[key].forEach(findAwaitCalls)
                } else {
                  findAwaitCalls(node[key])
                }
              }
            }
          }
          
          findAwaitCalls(body)
          
          if (awaitCalls.length > 0 && !hasTryCatch) {
            context.report({
              node,
              message: 'Async function with await calls must include try-catch error handling'
            })
          }
        }
        
        return {
          FunctionDeclaration: checkAsyncFunction,
          FunctionExpression: checkAsyncFunction,
          ArrowFunctionExpression: checkAsyncFunction
        }
      }
    },

    /**
     * Rule: require-parameter-validation
     * Objective: Binary check for input parameter validation
     */
    'require-parameter-validation': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require validation of function parameters',
          category: 'LLM Security',
          recommended: true
        },
        schema: [{
          type: 'object',
          properties: {
            exemptFunctions: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          additionalProperties: false
        }]
      },
      create(context) {
        const options = context.options[0] || {}
        const exemptFunctions = options.exemptFunctions || ['test', 'describe', 'it', 'beforeEach', 'afterEach']
        
        function checkFunction(node) {
          const functionName = node.id ? node.id.name : 'anonymous'
          
          if (exemptFunctions.includes(functionName)) return
          if (node.params.length === 0) return
          
          const body = node.body
          if (body.type !== 'BlockStatement') return
          
          // Check for parameter validation in first few statements
          const validationStatements = body.body.slice(0, 3)
          const hasValidation = validationStatements.some(statement => {
            if (statement.type === 'IfStatement') {
              // Check for parameter checks
              const test = statement.test
              return test && (
                test.type === 'UnaryExpression' ||
                test.type === 'BinaryExpression' ||
                (test.type === 'CallExpression' && test.callee.name === 'typeof')
              )
            }
            return false
          })
          
          if (!hasValidation) {
            context.report({
              node,
              message: 'Function with parameters should validate inputs at the beginning'
            })
          }
        }
        
        return {
          FunctionDeclaration: checkFunction,
          FunctionExpression: checkFunction
        }
      }
    },

    /**
     * Rule: no-sacred-violations
     * Objective: Binary check for sacred document principle violations
     */
    'no-sacred-violations': {
      meta: {
        type: 'error',
        docs: {
          description: 'Disallow violations of sacred document principles',
          category: 'LLM Sacred Principles',
          recommended: true
        },
        schema: []
      },
      create(context) {
        const sourceCode = context.getSourceCode()
        const code = sourceCode.getText()
        
        // Sacred principle violation patterns
        const violations = [
          {
            pattern: /(mock|fake|simulate|placeholder)/gi,
            message: 'Violates NO SIMULATIONS principle - avoid mock/fake/simulate patterns',
            principle: 'NO_SIMULATIONS'
          },
          {
            pattern: /(fallback.*error|catch.*ignore|default.*catch)/gi,
            message: 'Violates NO FALLBACKS principle - avoid fallback error handling',
            principle: 'NO_FALLBACKS'
          },
          {
            pattern: /(template|boilerplate|generic.*example)/gi,
            message: 'Violates NO TEMPLATES principle - avoid template/boilerplate code',
            principle: 'NO_TEMPLATES'
          },
          {
            pattern: /(example\.com|test@test|fake.*data|sample.*data)/gi,
            message: 'Violates ALWAYS REAL principle - avoid fake example data',
            principle: 'ALWAYS_REAL'
          }
        ]
        
        return {
          Program(node) {
            violations.forEach(violation => {
              const matches = code.match(violation.pattern)
              if (matches) {
                context.report({
                  node,
                  message: `${violation.message} (${violation.principle})`,
                  data: {
                    principle: violation.principle,
                    matches: matches.slice(0, 3) // Show first 3 matches
                  }
                })
              }
            })
          }
        }
      }
    },

    /**
     * Rule: require-real-implementation
     * Objective: Binary check for complete, non-placeholder implementations
     */
    'require-real-implementation': {
      meta: {
        type: 'error',
        docs: {
          description: 'Require complete, real implementations without placeholders',
          category: 'LLM Implementation Quality',
          recommended: true
        },
        schema: [{
          type: 'object',
          properties: {
            allowInTests: {
              type: 'boolean'
            }
          },
          additionalProperties: false
        }]
      },
      create(context) {
        const options = context.options[0] || {}
        const allowInTests = options.allowInTests || false
        const filename = context.getFilename()
        const isTestFile = /\.(test|spec)\.(js|ts|jsx|tsx)$/.test(filename)
        
        if (allowInTests && isTestFile) return {}
        
        const placeholderPatterns = [
          /TODO:/gi,
          /FIXME:/gi,
          /XXX:/gi,
          /\.\.\.\s*$/gm, // Ellipsis at end of line
          /\/\/ More code here/gi,
          /\/\* TODO: implement \*\//gi,
          /throw new Error\(['"]Not implemented['"]\)/gi
        ]
        
        return {
          Program(node) {
            const sourceCode = context.getSourceCode()
            const code = sourceCode.getText()
            
            placeholderPatterns.forEach((pattern, index) => {
              const matches = code.match(pattern)
              if (matches) {
                context.report({
                  node,
                  message: 'Implementation contains placeholder or incomplete code - sacred principles require real implementations',
                  data: {
                    placeholderType: pattern.source,
                    count: matches.length
                  }
                })
              }
            })
          }
        }
      }
    },

    /**
     * Rule: no-security-antipatterns
     * Objective: Binary check for security vulnerabilities in LLM output
     */
    'no-security-antipatterns': {
      meta: {
        type: 'error',
        docs: {
          description: 'Disallow security antipatterns in LLM-generated code',
          category: 'LLM Security',
          recommended: true
        },
        schema: [{
          type: 'object',
          properties: {
            securityLevel: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical']
            }
          },
          additionalProperties: false
        }]
      },
      create(context) {
        const options = context.options[0] || {}
        const securityLevel = options.securityLevel || 'medium'
        
        const securityPatterns = {
          critical: [
            {
              pattern: /eval\s*\(/gi,
              message: 'Critical: eval() usage detected - XSS/code injection risk'
            },
            {
              pattern: /innerHTML\s*=/gi,
              message: 'Critical: innerHTML assignment - XSS risk'
            },
            {
              pattern: /document\.write/gi,
              message: 'Critical: document.write() usage - XSS risk'
            }
          ],
          high: [
            {
              pattern: /outerHTML\s*=/gi,
              message: 'High: outerHTML assignment - potential XSS risk'
            },
            {
              pattern: /Function\s*\(/gi,
              message: 'High: Function constructor usage - code injection risk'
            },
            {
              pattern: /(password|secret|key|token)\s*[=:]\s*['"][^'"]+['"]/gi,
              message: 'High: Hardcoded secrets detected'
            }
          ],
          medium: [
            {
              pattern: /setTimeout\s*\(\s*['"][^'"]*['"]/gi,
              message: 'Medium: setTimeout with string argument - avoid eval-like patterns'
            },
            {
              pattern: /setInterval\s*\(\s*['"][^'"]*['"]/gi,
              message: 'Medium: setInterval with string argument - avoid eval-like patterns'
            }
          ]
        }
        
        const getApplicablePatterns = (level) => {
          switch (level) {
            case 'critical':
              return securityPatterns.critical
            case 'high':
              return [...securityPatterns.critical, ...securityPatterns.high]
            case 'medium':
              return [...securityPatterns.critical, ...securityPatterns.high, ...securityPatterns.medium]
            case 'low':
              return securityPatterns.critical // Always check critical
            default:
              return [...securityPatterns.critical, ...securityPatterns.high]
          }
        }
        
        return {
          Program(node) {
            const sourceCode = context.getSourceCode()
            const code = sourceCode.getText()
            const patterns = getApplicablePatterns(securityLevel)
            
            patterns.forEach(({ pattern, message }) => {
              const matches = code.match(pattern)
              if (matches) {
                context.report({
                  node,
                  message,
                  data: {
                    securityLevel,
                    matchCount: matches.length,
                    pattern: pattern.source
                  }
                })
              }
            })
          }
        }
      }
    },

    /**
     * Rule: require-performance-consideration
     * Objective: Binary check for performance-conscious implementation
     */
    'require-performance-consideration': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Require consideration of performance implications',
          category: 'LLM Performance',
          recommended: false
        },
        schema: []
      },
      create(context) {
        const performanceAntipatterns = [
          {
            pattern: /for\s*\([^)]*\)\s*\{[^}]*for\s*\([^)]*\)\s*\{[^}]*for\s*\(/gi,
            message: 'Triple nested loops detected - consider optimization'
          },
          {
            pattern: /\.forEach\s*\([^)]*\).*\.forEach\s*\(/gi,
            message: 'Nested forEach loops detected - consider alternative approaches'
          },
          {
            pattern: /JSON\.parse\s*\(.*JSON\.stringify/gi,
            message: 'Deep clone via JSON detected - consider more efficient alternatives'
          }
        ]
        
        return {
          Program(node) {
            const sourceCode = context.getSourceCode()
            const code = sourceCode.getText()
            
            performanceAntipatterns.forEach(({ pattern, message }) => {
              if (pattern.test(code)) {
                context.report({
                  node,
                  message
                })
              }
            })
          }
        }
      }
    }
  }
}

module.exports = plugin

/**
 * Utility functions for integration with validation system
 */
module.exports.validateLLMCode = function(code, options = {}) {
  const {
    enforcesSacredPrinciples = true,
    securityLevel = 'medium',
    checkPerformance = false
  } = options
  
  const results = {
    isValid: true,
    errors: [],
    warnings: [],
    securityIssues: [],
    sacredViolations: []
  }
  
  // Sacred principles check
  if (enforcesSacredPrinciples) {
    const sacredViolations = [
      { pattern: /(mock|fake|simulate)/gi, principle: 'NO_SIMULATIONS' },
      { pattern: /(fallback.*error)/gi, principle: 'NO_FALLBACKS' },
      { pattern: /(template|boilerplate)/gi, principle: 'NO_TEMPLATES' },
      { pattern: /(example\.com|test@test)/gi, principle: 'ALWAYS_REAL' }
    ]
    
    sacredViolations.forEach(({ pattern, principle }) => {
      if (pattern.test(code)) {
        results.sacredViolations.push({
          principle,
          message: `Code violates ${principle} sacred principle`
        })
        results.isValid = false
      }
    })
  }
  
  // Security check
  const securityPatterns = {
    critical: [/eval\s*\(/gi, /innerHTML\s*=/gi, /document\.write/gi],
    high: [/outerHTML\s*=/gi, /Function\s*\(/gi],
    medium: [/setTimeout\s*\(\s*['"][^'"]*['"]/gi]
  }
  
  const checkPatterns = {
    critical: securityPatterns.critical,
    high: [...securityPatterns.critical, ...securityPatterns.high],
    medium: [...securityPatterns.critical, ...securityPatterns.high, ...securityPatterns.medium],
    low: securityPatterns.critical
  }[securityLevel] || securityPatterns.medium
  
  checkPatterns.forEach(pattern => {
    if (pattern.test(code)) {
      results.securityIssues.push({
        pattern: pattern.source,
        severity: 'high'
      })
      results.isValid = false
    }
  })
  
  // Performance check
  if (checkPerformance) {
    const performanceIssues = [
      /for\s*\([^)]*\)\s*\{[^}]*for\s*\([^)]*\)\s*\{[^}]*for\s*\(/gi,
      /\.forEach\s*\([^)]*\).*\.forEach\s*\(/gi
    ]
    
    performanceIssues.forEach(pattern => {
      if (pattern.test(code)) {
        results.warnings.push({
          message: 'Performance concern detected',
          pattern: pattern.source
        })
      }
    })
  }
  
  return results
}

/**
 * Binary validation for quick pass/fail
 */
module.exports.binaryValidate = function(code, options = {}) {
  const validation = module.exports.validateLLMCode(code, options)
  return {
    isValid: validation.isValid,
    hasSecurityIssues: validation.securityIssues.length > 0,
    hasSacredViolations: validation.sacredViolations.length > 0,
    errorCount: validation.errors.length + validation.securityIssues.length + validation.sacredViolations.length,
    warningCount: validation.warnings.length
  }
}
/**
 * Comprehensive validation system for collaboration APIs
 */

import { CollaborationError, createValidationError, createSacredViolationError } from './error-handler.js';
import { performance } from 'perf_hooks';

/**
 * Validation schema definitions
 */
const VALIDATION_SCHEMAS = {
  sessionId: {
    type: 'string',
    required: true,
    pattern: /^collab_\d+_[a-z0-9]{9}$/,
    message: 'Session ID must follow format: collab_timestamp_randomstring'
  },

  draftId: {
    type: 'string',
    required: true,
    pattern: /^draft_\d+_[a-z0-9]{9}$/,
    message: 'Draft ID must follow format: draft_timestamp_randomstring'
  },

  checkpointId: {
    type: 'string',
    required: true,
    pattern: /^checkpoint_\d+_[a-z0-9]{6}$/,
    message: 'Checkpoint ID must follow format: checkpoint_timestamp_randomstring'
  },

  content: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 1000000, // 1MB limit
    message: 'Content must be a non-empty string under 1MB'
  },

  title: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 200,
    message: 'Title must be between 1 and 200 characters'
  },

  description: {
    type: 'string',
    required: false,
    maxLength: 1000,
    message: 'Description must be under 1000 characters'
  },

  agentAuth: {
    type: 'string',
    required: true,
    minLength: 32,
    message: 'Agent authentication token required'
  },

  operation: {
    type: 'string',
    required: true,
    enum: ['process', 'gather-requirements', 'research', 'decompose-task', 'process-full-task'],
    message: 'Operation must be one of the supported types'
  },

  resolutionStrategy: {
    type: 'string',
    required: false,
    enum: ['manual', 'auto', 'ai-assisted'],
    message: 'Resolution strategy must be manual, auto, or ai-assisted'
  },

  conflictResolution: {
    type: 'string',
    required: false,
    enum: ['overwrite', 'merge', 'fail'],
    message: 'Conflict resolution must be overwrite, merge, or fail'
  },

  eventType: {
    type: 'string',
    required: true,
    pattern: /^[a-z][a-z0-9-]*$/,
    message: 'Event type must be lowercase with hyphens'
  },

  component: {
    type: 'string',
    required: true,
    enum: ['ideation', 'orchestration', 'execution', 'merge', 'workflow'],
    message: 'Component must be one of the valid collaboration components'
  },

  // LLM Output Validation Schemas
  llmOutputType: {
    type: 'string',
    required: true,
    enum: ['code', 'documentation', 'ui-component', 'api-response', 'config', 'test', 'schema'],
    message: 'LLM output type must be one of the supported types'
  },

  codeLanguage: {
    type: 'string',
    required: false,
    enum: ['javascript', 'typescript', 'python', 'html', 'css', 'json', 'yaml', 'markdown', 'jsx', 'tsx'],
    message: 'Code language must be one of the supported languages'
  },

  securityLevel: {
    type: 'string',
    required: false,
    enum: ['low', 'medium', 'high', 'critical'],
    message: 'Security level must be low, medium, high, or critical'
  },

  validationLevel: {
    type: 'string',
    required: false,
    enum: ['basic', 'strict', 'sacred'],
    message: 'Validation level must be basic, strict, or sacred'
  }
};

/**
 * Binary LLM Output Validation with Performance Tracking
 */
export function validateLLMOutput(output, outputType, options = {}) {
  const startTime = performance.now();
  const {
    language = null,
    securityLevel = 'medium',
    validationLevel = 'strict',
    enforcesSacredPrinciples = false
  } = options;

  try {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      securityIssues: [],
      sacredViolations: [],
      performanceMs: 0,
      validationScore: 0
    };

    // Basic structure validation
    const structureValidation = validateOutputStructure(output, outputType, language);
    validation.errors.push(...structureValidation.errors);
    validation.warnings.push(...structureValidation.warnings);

    // Security validation
    const securityValidation = validateSecurity(output, outputType, securityLevel);
    validation.securityIssues.push(...securityValidation.issues);
    validation.errors.push(...securityValidation.criticalErrors);

    // Sacred principles validation (if enabled)
    if (enforcesSacredPrinciples) {
      const sacredValidation = validateSacredPrinciples(output, outputType);
      validation.sacredViolations.push(...sacredValidation.violations);
      if (sacredValidation.violations.length > 0) {
        validation.errors.push({
          code: 'SACRED_VIOLATION',
          message: 'Output violates sacred document principles',
          violations: sacredValidation.violations
        });
      }
    }

    // Content quality validation
    const qualityValidation = validateContentQuality(output, outputType, validationLevel);
    validation.warnings.push(...qualityValidation.warnings);
    if (validationLevel === 'strict') {
      validation.errors.push(...qualityValidation.errors);
    }

    // Calculate validation score (0-100)
    validation.validationScore = calculateValidationScore(validation);
    validation.isValid = validation.errors.length === 0;
    validation.performanceMs = performance.now() - startTime;

    return validation;
  } catch (error) {
    return {
      isValid: false,
      errors: [{ code: 'VALIDATION_FAILURE', message: error.message }],
      warnings: [],
      securityIssues: [],
      sacredViolations: [],
      performanceMs: performance.now() - startTime,
      validationScore: 0
    };
  }
}

/**
 * Validate LLM output structure based on type
 */
function validateOutputStructure(output, outputType, language) {
  const result = { errors: [], warnings: [] };

  if (!output || typeof output !== 'string') {
    result.errors.push({
      code: 'INVALID_OUTPUT_TYPE',
      message: 'Output must be a non-empty string'
    });
    return result;
  }

  switch (outputType) {
    case 'code':
      return validateCodeStructure(output, language);
    case 'documentation':
      return validateDocumentationStructure(output);
    case 'ui-component':
      return validateUIComponentStructure(output, language);
    case 'api-response':
      return validateAPIResponseStructure(output);
    case 'config':
      return validateConfigStructure(output, language);
    case 'test':
      return validateTestStructure(output, language);
    case 'schema':
      return validateSchemaStructure(output);
    default:
      result.warnings.push({
        code: 'UNKNOWN_OUTPUT_TYPE',
        message: `Unknown output type: ${outputType}`
      });
  }

  return result;
}

/**
 * Validate code structure
 */
function validateCodeStructure(code, language) {
  const result = { errors: [], warnings: [] };

  // Basic syntax validation
  try {
    if (language === 'javascript' || language === 'jsx') {
      // Basic JS syntax checks
      if (!isValidJavaScript(code)) {
        result.errors.push({
          code: 'INVALID_SYNTAX',
          message: 'JavaScript syntax validation failed'
        });
      }
    } else if (language === 'json') {
      JSON.parse(code);
    } else if (language === 'yaml') {
      // Basic YAML structure check
      if (!isValidYAML(code)) {
        result.errors.push({
          code: 'INVALID_YAML',
          message: 'YAML structure validation failed'
        });
      }
    }
  } catch (error) {
    result.errors.push({
      code: 'PARSE_ERROR',
      message: `Parse error: ${error.message}`
    });
  }

  // Check for common code quality issues
  if (code.includes('TODO:') || code.includes('FIXME:')) {
    result.warnings.push({
      code: 'INCOMPLETE_CODE',
      message: 'Code contains TODO or FIXME comments'
    });
  }

  if (code.includes('console.log') && language === 'javascript') {
    result.warnings.push({
      code: 'DEBUG_CODE',
      message: 'Code contains console.log statements'
    });
  }

  return result;
}

/**
 * Validate documentation structure
 */
function validateDocumentationStructure(content) {
  const result = { errors: [], warnings: [] };

  // Check for basic markdown structure
  if (!content.includes('#')) {
    result.warnings.push({
      code: 'NO_HEADERS',
      message: 'Documentation lacks header structure'
    });
  }

  // Check for code examples in backticks
  const codeBlocks = content.match(/```[\s\S]*?```/g);
  if (codeBlocks) {
    codeBlocks.forEach((block, index) => {
      if (!block.includes('\n')) {
        result.warnings.push({
          code: 'SINGLE_LINE_CODE_BLOCK',
          message: `Code block ${index + 1} is single line, consider using inline code`
        });
      }
    });
  }

  return result;
}

/**
 * Validate UI component structure
 */
function validateUIComponentStructure(content, language) {
  const result = { errors: [], warnings: [] };

  if (language === 'jsx' || language === 'tsx') {
    // Check for proper JSX structure
    if (!content.includes('return')) {
      result.errors.push({
        code: 'NO_RETURN_STATEMENT',
        message: 'JSX component must have return statement'
      });
    }

    // Check for proper component export
    if (!content.includes('export') && !content.includes('module.exports')) {
      result.warnings.push({
        code: 'NO_EXPORT',
        message: 'Component should be exported'
      });
    }

    // Check for accessibility attributes
    if (content.includes('<button') && !content.includes('aria-')) {
      result.warnings.push({
        code: 'ACCESSIBILITY_MISSING',
        message: 'Interactive elements should include accessibility attributes'
      });
    }
  }

  return result;
}

/**
 * Validate API response structure
 */
function validateAPIResponseStructure(content) {
  const result = { errors: [], warnings: [] };

  try {
    const parsed = JSON.parse(content);

    // Check for standard API response structure
    if (!parsed.hasOwnProperty('data') && !parsed.hasOwnProperty('error')) {
      result.warnings.push({
        code: 'NON_STANDARD_STRUCTURE',
        message: 'API response should include data or error fields'
      });
    }

    // Check for error field structure
    if (parsed.error && typeof parsed.error !== 'object') {
      result.warnings.push({
        code: 'INVALID_ERROR_STRUCTURE',
        message: 'Error field should be an object with message and code'
      });
    }
  } catch (error) {
    result.errors.push({
      code: 'INVALID_JSON',
      message: 'API response must be valid JSON'
    });
  }

  return result;
}

/**
 * Validate configuration structure
 */
function validateConfigStructure(content, language) {
  const result = { errors: [], warnings: [] };

  try {
    if (language === 'json') {
      const config = JSON.parse(content);

      // Check for sensitive data
      const sensitiveKeys = ['password', 'secret', 'key', 'token', 'api_key'];
      const checkForSensitiveData = (obj, path = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;

          if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
            if (typeof value === 'string' && value.length > 0) {
              result.warnings.push({
                code: 'SENSITIVE_DATA_EXPOSED',
                message: `Potential sensitive data in config: ${currentPath}`
              });
            }
          }

          if (typeof value === 'object' && value !== null) {
            checkForSensitiveData(value, currentPath);
          }
        }
      };

      checkForSensitiveData(config);
    }
  } catch (error) {
    result.errors.push({
      code: 'INVALID_CONFIG',
      message: `Configuration validation failed: ${error.message}`
    });
  }

  return result;
}

/**
 * Validate test structure
 */
function validateTestStructure(content, language) {
  const result = { errors: [], warnings: [] };

  // Check for test framework patterns
  const testPatterns = ['describe(', 'it(', 'test(', 'expect('];
  const hasTestPatterns = testPatterns.some(pattern => content.includes(pattern));

  if (!hasTestPatterns) {
    result.warnings.push({
      code: 'NO_TEST_PATTERNS',
      message: 'Content does not appear to contain test patterns'
    });
  }

  // Check for assertions
  if (!content.includes('expect') && !content.includes('assert')) {
    result.warnings.push({
      code: 'NO_ASSERTIONS',
      message: 'Tests should contain assertions'
    });
  }

  return result;
}

/**
 * Validate schema structure
 */
function validateSchemaStructure(content) {
  const result = { errors: [], warnings: [] };

  try {
    const schema = JSON.parse(content);

    // Check for JSON Schema structure
    if (!schema.type && !schema.$schema) {
      result.warnings.push({
        code: 'NO_SCHEMA_TYPE',
        message: 'Schema should specify a type or $schema field'
      });
    }

    // Check for required properties in object schemas
    if (schema.type === 'object' && schema.properties && !schema.required) {
      result.warnings.push({
        code: 'NO_REQUIRED_FIELDS',
        message: 'Object schema should specify required fields'
      });
    }
  } catch (error) {
    result.errors.push({
      code: 'INVALID_SCHEMA',
      message: 'Schema must be valid JSON'
    });
  }

  return result;
}

/**
 * Security validation for LLM outputs
 */
function validateSecurity(output, outputType, securityLevel) {
  const result = { issues: [], criticalErrors: [] };

  // Check for potential security vulnerabilities
  const securityPatterns = {
    xss: /<script[^>]*>.*?<\/script>/gi,
    sqlInjection: /(union|select|insert|update|delete|drop|exec|execute)\s+/gi,
    pathTraversal: /\.\.\/|\.\.\\/g,
    hardcodedSecrets: /(password|secret|key|token)\s*[=:]\s*[''][^'']+['"]/gi,
    dangerousEval: /(eval|Function|setTimeout|setInterval)\s*\(/gi,
    htmlInjection: /<[^>]+on\w+\s*=/gi
  };

  for (const [vulnerability, pattern] of Object.entries(securityPatterns)) {
    const matches = output.match(pattern);
    if (matches) {
      const severity = getSeverityForVulnerability(vulnerability, securityLevel);
      const issue = {
        code: `SECURITY_${vulnerability.toUpperCase()}`,
        message: `Potential ${vulnerability} vulnerability detected`,
        severity,
        matches: matches.slice(0, 3) // Limit to first 3 matches
      };

      if (severity === 'critical') {
        result.criticalErrors.push(issue);
      } else {
        result.issues.push(issue);
      }
    }
  }

  // Additional security checks based on output type
  if (outputType === 'code') {
    // Check for unsafe practices
    if (output.includes('innerHTML') || output.includes('outerHTML')) {
      result.issues.push({
        code: 'UNSAFE_HTML_MANIPULATION',
        message: 'Direct HTML manipulation detected, consider using safer alternatives',
        severity: 'medium'
      });
    }

    if (output.includes('document.write')) {
      result.issues.push({
        code: 'UNSAFE_DOCUMENT_WRITE',
        message: 'document.write usage detected, known XSS vector',
        severity: 'high'
      });
    }
  }

  return result;
}

/**
 * Get severity level for security vulnerability
 */
function getSeverityForVulnerability(vulnerability, securityLevel) {
  const severityMap = {
    low: {
      xss: 'medium',
      sqlInjection: 'high',
      pathTraversal: 'high',
      hardcodedSecrets: 'medium',
      dangerousEval: 'medium',
      htmlInjection: 'medium'
    },
    medium: {
      xss: 'high',
      sqlInjection: 'critical',
      pathTraversal: 'critical',
      hardcodedSecrets: 'high',
      dangerousEval: 'high',
      htmlInjection: 'high'
    },
    high: {
      xss: 'critical',
      sqlInjection: 'critical',
      pathTraversal: 'critical',
      hardcodedSecrets: 'critical',
      dangerousEval: 'critical',
      htmlInjection: 'critical'
    },
    critical: {
      xss: 'critical',
      sqlInjection: 'critical',
      pathTraversal: 'critical',
      hardcodedSecrets: 'critical',
      dangerousEval: 'critical',
      htmlInjection: 'critical'
    }
  };

  return severityMap[securityLevel]?.[vulnerability] || 'medium';
}

/**
 * Validate against sacred document principles
 */
function validateSacredPrinciples(output, outputType) {
  const violations = [];

  // Sacred principle checks
  const sacredChecks = {
    noSimulations: {
      patterns: [/mock|fake|simulate|placeholder|todo/gi],
      message: 'Contains simulation, mock, or placeholder content (violates NO SIMULATIONS)'
    },
    noFallbacks: {
      patterns: [/fallback|default.*error|catch.*ignore/gi],
      message: 'Contains fallback mechanisms (violates NO FALLBACKS)'
    },
    noTemplates: {
      patterns: [/template|boilerplate|generic.*example/gi],
      message: 'Contains template or boilerplate code (violates NO TEMPLATES)'
    },
    alwaysReal: {
      patterns: [/example\.com|test@test|fake.*data|sample.*data/gi],
      message: 'Contains fake example data (violates ALWAYS REAL)'
    }
  };

  for (const [principle, check] of Object.entries(sacredChecks)) {
    for (const pattern of check.patterns) {
      if (pattern.test(output)) {
        violations.push({
          principle,
          message: check.message,
          severity: 'critical'
        });
        break; // One violation per principle is enough
      }
    }
  }

  return { violations };
}

/**
 * Validate content quality
 */
function validateContentQuality(output, outputType, validationLevel) {
  const result = { errors: [], warnings: [] };

  // Check content length
  if (output.length < 10) {
    result.warnings.push({
      code: 'CONTENT_TOO_SHORT',
      message: 'Content appears to be too short'
    });
  }

  // Check for proper formatting
  if (outputType === 'code') {
    // Check indentation consistency
    const lines = output.split('\n');
    const indentations = lines
      .filter(line => line.trim().length > 0)
      .map(line => line.match(/^\s*/)[0].length);

    if (indentations.length > 1) {
      const uniqueIndents = [...new Set(indentations)];
      if (uniqueIndents.length > 4) {
        result.warnings.push({
          code: 'INCONSISTENT_INDENTATION',
          message: 'Code has inconsistent indentation'
        });
      }
    }
  }

  // Check for completeness
  if (output.includes('...') || output.includes('// More code here')) {
    if (validationLevel === 'strict') {
      result.errors.push({
        code: 'INCOMPLETE_CONTENT',
        message: 'Content appears to be incomplete'
      });
    } else {
      result.warnings.push({
        code: 'INCOMPLETE_CONTENT',
        message: 'Content appears to be incomplete'
      });
    }
  }

  return result;
}

/**
 * Calculate validation score (0-100)
 */
function calculateValidationScore(validation) {
  let score = 100;

  // Deduct points for issues
  score -= validation.errors.length * 15;
  score -= validation.warnings.length * 5;
  score -= validation.securityIssues.filter(issue => issue.severity === 'critical').length * 25;
  score -= validation.securityIssues.filter(issue => issue.severity === 'high').length * 15;
  score -= validation.securityIssues.filter(issue => issue.severity === 'medium').length * 8;
  score -= validation.sacredViolations.length * 30;

  return Math.max(0, score);
}

/**
 * Helper functions for syntax validation
 */
function isValidJavaScript(code) {
  try {
    // Basic syntax check using Function constructor
    new Function(code);
    return true;
  } catch (error) {
    return false;
  }
}

function isValidYAML(yaml) {
  // Basic YAML structure validation
  const lines = yaml.split('\n');
  const indentLevel = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const currentIndent = line.length - line.trimStart().length;
    if (currentIndent % 2 !== 0) return false; // YAML uses 2-space indentation
  }

  return true;
}

/**
 * Main validation function
 */
export function validateRequest(data, schema) {
  const errors = [];
  const validated = {};

  // Validate each field in schema
  Object.entries(schema).forEach(([field, rules]) => {
    const value = data[field];
    const fieldErrors = validateField(field, value, rules);

    if (fieldErrors.length > 0) {
      errors.push(...fieldErrors);
    } else if (value !== undefined) {
      validated[field] = value;
    }
  });

  if (errors.length > 0) {
    throw createValidationError('request', 'Multiple validation errors', errors);
  }

  return validated;
}

/**
 * Validate a single field
 */
function validateField(fieldName, value, rules) {
  const errors = [];

  // Check required
  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push({
      field: fieldName,
      code: 'REQUIRED',
      message: `${fieldName} is required`
    });
    return errors; // Don't validate further if required field is missing
  }

  // Skip further validation if value is not provided and not required
  if (value === undefined || value === null) {
    return errors;
  }

  // Check type
  if (rules.type && typeof value !== rules.type) {
    errors.push({
      field: fieldName,
      code: 'INVALID_TYPE',
      message: `${fieldName} must be of type ${rules.type}, got ${typeof value}`
    });
    return errors;
  }

  // Check string-specific rules
  if (rules.type === 'string' && typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      errors.push({
        field: fieldName,
        code: 'TOO_SHORT',
        message: `${fieldName} must be at least ${rules.minLength} characters long`
      });
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push({
        field: fieldName,
        code: 'TOO_LONG',
        message: `${fieldName} must be at most ${rules.maxLength} characters long`
      });
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push({
        field: fieldName,
        code: 'INVALID_FORMAT',
        message: rules.message || `${fieldName} format is invalid`
      });
    }
  }

  // Check enum values
  if (rules.enum && !rules.enum.includes(value)) {
    errors.push({
      field: fieldName,
      code: 'INVALID_VALUE',
      message: `${fieldName} must be one of: ${rules.enum.join(', ')}`
    });
  }

  // Check number-specific rules
  if (rules.type === 'number' && typeof value === 'number') {
    if (rules.min && value < rules.min) {
      errors.push({
        field: fieldName,
        code: 'TOO_SMALL',
        message: `${fieldName} must be at least ${rules.min}`
      });
    }

    if (rules.max && value > rules.max) {
      errors.push({
        field: fieldName,
        code: 'TOO_LARGE',
        message: `${fieldName} must be at most ${rules.max}`
      });
    }
  }

  return errors;
}

/**
 * Predefined validation schemas for common requests
 */
export const SCHEMAS = {
  // Session operations
  createSession: {
    userSettings: { type: 'object', required: false },
    githubConfig: { type: 'object', required: false },
    initialMode: { type: 'string', required: false }
  },

  // Draft operations
  createDraft: {
    sessionId: VALIDATION_SCHEMAS.sessionId,
    content: VALIDATION_SCHEMAS.content,
    title: VALIDATION_SCHEMAS.title,
    description: VALIDATION_SCHEMAS.description
  },

  updateDraft: {
    draftId: VALIDATION_SCHEMAS.draftId,
    content: VALIDATION_SCHEMAS.content,
    title: { ...VALIDATION_SCHEMAS.title, required: false },
    description: VALIDATION_SCHEMAS.description,
    conflictResolution: VALIDATION_SCHEMAS.conflictResolution
  },

  // Checkpoint operations
  createCheckpoint: {
    sessionId: VALIDATION_SCHEMAS.sessionId,
    type: { type: 'string', required: true, maxLength: 50 },
    description: { type: 'string', required: true, maxLength: 200 },
    data: { type: 'object', required: true },
    filePaths: { type: 'object', required: false } // Array of strings
  },

  executeCheckpoint: {
    checkpointId: VALIDATION_SCHEMAS.checkpointId,
    operation: { type: 'string', required: true, enum: ['rollback', 'validate', 'merge', 'commit'] },
    operationData: { type: 'object', required: false },
    timeout: { type: 'number', required: false, min: 1000, max: 300000 },
    retries: { type: 'number', required: false, min: 1, max: 10 }
  },

  // State synchronization
  updateState: {
    sessionId: VALIDATION_SCHEMAS.sessionId,
    component: VALIDATION_SCHEMAS.component,
    data: { type: 'object', required: true },
    broadcast: { type: 'boolean', required: false },
    conflictResolution: VALIDATION_SCHEMAS.conflictResolution
  },

  // Meta-agent operations
  metaAgentIntegrate: {
    sessionId: VALIDATION_SCHEMAS.sessionId,
    operation: VALIDATION_SCHEMAS.operation,
    message: { type: 'string', required: false, maxLength: 10000 },
    context: { type: 'object', required: false },
    options: { type: 'object', required: false }
  },

  // Merge operations
  resolveMerge: {
    sessionId: VALIDATION_SCHEMAS.sessionId,
    originalContent: VALIDATION_SCHEMAS.content,
    modifiedContent: VALIDATION_SCHEMAS.content,
    conflicts: { type: 'object', required: false }, // Array
    resolutionStrategy: VALIDATION_SCHEMAS.resolutionStrategy,
    userResolutions: { type: 'object', required: false },
    preserveSacredSections: { type: 'boolean', required: false }
  },

  detectConflicts: {
    sessionId: VALIDATION_SCHEMAS.sessionId,
    originalContent: VALIDATION_SCHEMAS.content,
    modifiedContent: VALIDATION_SCHEMAS.content,
    detectSacredViolations: { type: 'boolean', required: false },
    conflictThreshold: { type: 'string', required: false, enum: ['low', 'medium', 'high'] }
  },

  // LLM Output Validation Schemas
  validateLLMOutput: {
    output: VALIDATION_SCHEMAS.content,
    outputType: VALIDATION_SCHEMAS.llmOutputType,
    language: VALIDATION_SCHEMAS.codeLanguage,
    securityLevel: VALIDATION_SCHEMAS.securityLevel,
    validationLevel: VALIDATION_SCHEMAS.validationLevel,
    enforcesSacredPrinciples: { type: 'boolean', required: false }
  },

  binaryValidation: {
    content: VALIDATION_SCHEMAS.content,
    validationType: { type: 'string', required: true, enum: ['syntax', 'security', 'quality', 'sacred', 'complete'] },
    strictMode: { type: 'boolean', required: false },
    performanceThreshold: { type: 'number', required: false, min: 1, max: 1000 }
  }
};

/**
 * Validate common query parameters
 */
export function validateQueryParams(query, allowedParams = []) {
  const validated = {};
  const errors = [];

  Object.entries(query).forEach(([key, value]) => {
    if (!allowedParams.includes(key)) {
      errors.push({
        field: key,
        code: 'UNKNOWN_PARAMETER',
        message: `Unknown query parameter: ${key}`
      });
      return;
    }

    // Convert string values to appropriate types
    if (value === 'true') {
      validated[key] = true;
    } else if (value === 'false') {
      validated[key] = false;
    } else if (/^\d+$/.test(value)) {
      validated[key] = parseInt(value, 10);
    } else {
      validated[key] = value;
    }
  });

  if (errors.length > 0) {
    throw createValidationError('query', 'Invalid query parameters', errors);
  }

  return validated;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(query) {
  const { limit = 20, offset = 0 } = query;

  const errors = [];

  if (isNaN(limit) || limit < 1 || limit > 100) {
    errors.push({
      field: 'limit',
      code: 'INVALID_LIMIT',
      message: 'Limit must be between 1 and 100'
    });
  }

  if (isNaN(offset) || offset < 0) {
    errors.push({
      field: 'offset',
      code: 'INVALID_OFFSET',
      message: 'Offset must be a non-negative number'
    });
  }

  if (errors.length > 0) {
    throw createValidationError('pagination', 'Invalid pagination parameters', errors);
  }

  return {
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10)
  };
}

/**
 * Content-specific validation
 */
export function validateContent(content, options = {}) {
  const {
    maxSize = 1000000, // 1MB
    allowEmpty = false,
    requireMarkdown = false
  } = options;

  const errors = [];

  if (!content && !allowEmpty) {
    errors.push({
      field: 'content',
      code: 'CONTENT_REQUIRED',
      message: 'Content is required'
    });
    return errors;
  }

  if (content && content.length > maxSize) {
    errors.push({
      field: 'content',
      code: 'CONTENT_TOO_LARGE',
      message: `Content must be under ${maxSize} characters`
    });
  }

  if (requireMarkdown && content && !isValidMarkdown(content)) {
    errors.push({
      field: 'content',
      code: 'INVALID_MARKDOWN',
      message: 'Content must be valid Markdown'
    });
  }

  return errors;
}

/**
 * Check if content is valid Markdown (basic validation)
 */
function isValidMarkdown(content) {
  // Basic markdown validation - check for common patterns
  const lines = content.split('\n');
  let hasHeaders = false;

  for (const line of lines) {
    // Check for valid header syntax
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch) {
      hasHeaders = true;
      // Validate header level progression (optional)
    }

    // Check for malformed syntax that could break rendering
    if (line.includes('```') && !line.trim().startsWith('```')) {
      return false; // Malformed code block
    }
  }

  return true; // Basic validation passed
}

/**
 * Rate limiting validation
 */
export function validateRateLimit(operation, context = {}) {
  // Placeholder for rate limiting logic
  // This would integrate with a rate limiting service
  const limits = {
    'create-draft': { max: 100, window: 3600 }, // 100 per hour
    'update-draft': { max: 500, window: 3600 }, // 500 per hour
    'create-checkpoint': { max: 50, window: 3600 }, // 50 per hour
    'meta-agent': { max: 200, window: 3600 } // 200 per hour
  };

  const limit = limits[operation];
  if (limit) {
    // Rate limiting logic would go here
    // For now, just return success
    return { allowed: true, remaining: limit.max };
  }

  return { allowed: true, remaining: Infinity };
}

/**
 * Real-time validation feedback system
 */
export class ValidationFeedbackSystem {
  constructor() {
    this.validationCache = new Map();
    this.performanceMetrics = [];
  }

  /**
   * Validate with caching and performance tracking
   */
  async validateWithFeedback(content, options = {}) {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(content, options);

    // Check cache first
    if (this.validationCache.has(cacheKey)) {
      const cached = this.validationCache.get(cacheKey);
      cached.fromCache = true;
      cached.performanceMs = performance.now() - startTime;
      return cached;
    }

    // Perform validation
    const result = validateLLMOutput(
      content,
      options.outputType || 'code',
      options
    );

    // Cache result
    this.validationCache.set(cacheKey, { ...result, timestamp: Date.now() });
    this.cleanupCache();

    // Track performance
    this.trackPerformance(result.performanceMs);

    return result;
  }

  /**
   * Generate cache key for validation
   */
  generateCacheKey(content, options) {
    const hash = this.simpleHash(content);
    const optionsHash = this.simpleHash(JSON.stringify(options));
    return `${hash}_${optionsHash}`;
  }

  /**
   * Simple hash function for caching
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Cleanup old cache entries
   */
  cleanupCache() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [key, value] of this.validationCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.validationCache.delete(key);
      }
    }

    // Limit cache size
    if (this.validationCache.size > 100) {
      const entries = Array.from(this.validationCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < 20; i++) {
        this.validationCache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Track validation performance
   */
  trackPerformance(duration) {
    this.performanceMetrics.push({
      duration,
      timestamp: Date.now()
    });

    // Keep only last 100 measurements
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics.shift();
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    if (this.performanceMetrics.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const durations = this.performanceMetrics.map(m => m.duration);
    return {
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      count: durations.length,
      under100ms: durations.filter(d => d < 100).length / durations.length * 100
    };
  }
}

// Export singleton instance
export const validationFeedback = new ValidationFeedbackSystem();

/**
 * Binary validation function for quick pass/fail checks
 */
export function binaryValidate(content, validationType, options = {}) {
  const startTime = performance.now();
  const { strictMode = false, performanceThreshold = 100 } = options;

  try {
    let isValid = true;
    const errors = [];

    switch (validationType) {
      case 'syntax':
        // Quick syntax validation
        try {
          if (content.includes('{') && content.includes('}')) {
            JSON.parse(content);
          }
        } catch (error) {
          isValid = false;
          errors.push('Invalid JSON syntax');
        }
        break;

      case 'security':
        // Quick security scan
        const dangerousPatterns = [
          /<script/i,
          /eval\s*\(/i,
          /innerHTML\s*=/i,
          /(password|secret|key)\s*[=:]\s*[''][^'']+['"]/i
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(content)) {
            isValid = false;
            errors.push('Security vulnerability detected');
            break;
          }
        }
        break;

      case 'quality':
        // Quick quality checks
        if (content.length < 10) {
          isValid = false;
          errors.push('Content too short');
        }
        if (content.includes('TODO') || content.includes('FIXME')) {
          if (strictMode) {
            isValid = false;
            errors.push('Incomplete code detected');
          }
        }
        break;

      case 'sacred':
        // Sacred principles validation
        const sacredViolations = [
          /mock|fake|simulate/gi,
          /fallback.*error/gi,
          /template|boilerplate/gi
        ];

        for (const pattern of sacredViolations) {
          if (pattern.test(content)) {
            isValid = false;
            errors.push('Sacred principle violation');
            break;
          }
        }
        break;

      case 'complete':
        // Completeness validation
        if (content.includes('...') || content.includes('// TODO')) {
          isValid = false;
          errors.push('Incomplete content');
        }
        break;

      default:
        isValid = false;
        errors.push(`Unknown validation type: ${validationType}`);
    }

    const performanceMs = performance.now() - startTime;

    // Check performance threshold
    if (performanceMs > performanceThreshold) {
      console.warn(`Validation exceeded performance threshold: ${performanceMs}ms > ${performanceThreshold}ms`);
    }

    return {
      isValid,
      errors,
      performanceMs,
      validationType,
      withinThreshold: performanceMs <= performanceThreshold
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation failed: ${error.message}`],
      performanceMs: performance.now() - startTime,
      validationType,
      withinThreshold: false
    };
  }
}

/**
 * Integration validation for collaboration APIs
 */
export function validateCollaborationIntegration(data, operationType) {
  const startTime = performance.now();

  try {
    // Validate based on operation type
    const validation = validateLLMOutput(
      data.content || '',
      data.outputType || 'code',
      {
        language: data.language,
        securityLevel: 'high', // Always high security for collaboration
        validationLevel: 'strict',
        enforcesSacredPrinciples: true
      }
    );

    // Add collaboration-specific checks
    if (operationType === 'process-full-task') {
      // Full task processing requires complete, non-template content
      if (validation.sacredViolations.length > 0) {
        throw createSacredViolationError(validation.sacredViolations);
      }
    }

    // Performance requirement: <100ms
    if (validation.performanceMs > 100) {
      console.warn(`Collaboration validation exceeded 100ms: ${validation.performanceMs}ms`);
    }

    return {
      ...validation,
      collaborationReady: validation.isValid && validation.validationScore >= 80,
      operationType
    };
  } catch (error) {
    throw createValidationError(
      'collaboration-integration',
      `Collaboration validation failed: ${error.message}`,
      { operationType, performanceMs: performance.now() - startTime }
    );
  }
}

/**
 * Middleware to validate requests
 */
export function withValidation(schema) {
  return (handler) => {
    return async (req, res) => {
      try {
        // Validate request body
        if (req.method !== 'GET' && schema) {
          req.validatedBody = validateRequest(req.body, schema);
        }

        // Continue to handler
        return await handler(req, res);
      } catch (error) {
        if (error instanceof CollaborationError) {
          const errorResponse = error.toJSON();
          return res.status(error.config.statusCode).json(errorResponse);
        }
        throw error;
      }
    };
  };
}

/**
 * Enhanced validation middleware with LLM output validation
 */
export function withLLMValidation(options = {}) {
  return (handler) => {
    return async (req, res) => {
      const startTime = performance.now();

      try {
        // Standard request validation
        if (req.method !== 'GET' && options.schema) {
          req.validatedBody = validateRequest(req.body, options.schema);
        }

        // LLM output validation if present
        if (req.body && req.body.output && options.validateLLMOutput) {
          const validation = await validationFeedback.validateWithFeedback(
            req.body.output,
            {
              outputType: req.body.outputType || 'code',
              language: req.body.language,
              securityLevel: options.securityLevel || 'medium',
              validationLevel: options.validationLevel || 'strict',
              enforcesSacredPrinciples: options.enforcesSacredPrinciples || false
            }
          );

          // Attach validation results
          req.validationResults = validation;

          // Fail if validation fails and strict mode is enabled
          if (!validation.isValid && options.strictMode) {
            return res.status(422).json({
              error: {
                code: 'LLM_OUTPUT_VALIDATION_FAILED',
                message: 'LLM output validation failed',
                details: validation
              }
            });
          }
        }

        // Continue to handler
        const result = await handler(req, res);

        // Log performance
        const totalTime = performance.now() - startTime;
        if (totalTime > 100) {
          console.warn(`Request processing exceeded 100ms: ${totalTime}ms`);
        }

        return result;
      } catch (error) {
        if (error instanceof CollaborationError) {
          const errorResponse = error.toJSON();
          return res.status(error.config.statusCode).json(errorResponse);
        }
        throw error;
      }
    };
  };
}

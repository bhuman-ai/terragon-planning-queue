/**
 * LLM Output Schema Definitions for Binary Validation
 * Security-focused schemas for different types of LLM outputs
 */

import { validateLLMOutput, binaryValidate } from './validation.js';

/**
 * Schema definitions for common LLM output types
 */
export const LLM_OUTPUT_SCHEMAS = {
  /**
   * JavaScript/TypeScript Code Schema
   */
  javascriptCode: {
    outputType: 'code',
    language: 'javascript',
    validationRules: {
      syntax: {
        required: true,
        patterns: {
          validFunction: /^(function|const|let|var|\s*\w+\s*[=:]\s*(function|\())/m,
          balancedBraces: /^[^{}]*(\{[^{}]*\}[^{}]*)*$/,
          noEval: /^(?!.*\beval\s*\().*/,
          noInnerHTML: /^(?!.*\binnerHTML\s*=).*/
        }
      },
      security: {
        required: true,
        forbiddenPatterns: [
          /eval\s*\(/gi,
          /innerHTML\s*=/gi,
          /document\.write/gi,
          /\.call\s*\(\s*null/gi,
          /Function\s*\(/gi
        ],
        allowedPatterns: [
          /console\.(log|error|warn|info)/gi,
          /JSON\.(parse|stringify)/gi,
          /Object\.(keys|values|entries)/gi
        ]
      },
      quality: {
        required: true,
        checks: {
          hasDocumentation: /\/\*\*[\s\S]*?\*\/|\/\/.*$/m,
          hasErrorHandling: /try\s*\{|catch\s*\(|\\.catch\s*\(/,
          noTodos: /^(?!.*TODO|.*FIXME|.*XXX).*/gi,
          properNaming: /^(?!.*[a-z][A-Z].*\$|.*\$\$).*/
        }
      }
    }
  },

  /**
   * React/JSX Component Schema
   */
  reactComponent: {
    outputType: 'ui-component',
    language: 'jsx',
    validationRules: {
      structure: {
        required: true,
        patterns: {
          hasReturn: /return\s*\(/m,
          hasExport: /(export\s+(default\s+)?|module\.exports\s*=)/,
          validJSX: /<[A-Z][a-zA-Z0-9]*[^>]*>|<[a-z][a-zA-Z0-9-]*[^>]*>/,
          noDangerouslySetInnerHTML: /^(?!.*dangerouslySetInnerHTML).*/
        }
      },
      accessibility: {
        required: true,
        patterns: {
          hasAriaLabels: /aria-\w+|role\s*=/,
          buttonAccessibility: /(?:<button[^>]*aria-|<button[^>]*role\s*=)/,
          imgAltText: /(?:<img[^>]*alt\s*=|<Image[^>]*alt\s*=)/
        }
      },
      hooks: {
        required: false,
        patterns: {
          useState: /const\s*\[\s*\w+\s*,\s*set\w+\s*\]\s*=\s*useState/,
          useEffect: /useEffect\s*\(/,
          useCallback: /useCallback\s*\(/,
          useMemo: /useMemo\s*\(/
        }
      }
    }
  },

  /**
   * API Response Schema
   */
  apiResponse: {
    outputType: 'api-response',
    language: 'json',
    validationRules: {
      structure: {
        required: true,
        checks: {
          validJSON: true,
          hasDataOrError: ['data', 'error'],
          errorStructure: {
            code: 'string',
            message: 'string',
            details: 'object'
          }
        }
      },
      security: {
        required: true,
        forbiddenFields: [
          'password',
          'secret',
          'privateKey',
          'token',
          'sessionId'
        ],
        sanitization: {
          stripScripts: true,
          stripHTML: true,
          validateUrls: true
        }
      }
    }
  },

  /**
   * Configuration File Schema
   */
  configFile: {
    outputType: 'config',
    language: 'json',
    validationRules: {
      security: {
        required: true,
        sensitiveKeys: [
          'password',
          'secret',
          'key',
          'token',
          'api_key',
          'private_key',
          'access_token'
        ],
        encryptionRequired: true,
        noPlaintextSecrets: true
      },
      structure: {
        required: true,
        checks: {
          validJSON: true,
          hasEnvironment: ['development', 'production', 'staging'],
          versionSpecified: /version|v\d+/
        }
      }
    }
  },

  /**
   * Test File Schema
   */
  testFile: {
    outputType: 'test',
    language: 'javascript',
    validationRules: {
      structure: {
        required: true,
        patterns: {
          hasTestFramework: /(describe|it|test|expect)\s*\(/,
          hasAssertions: /(expect|assert)\s*\(/,
          hasTestCases: /it\s*\(['"`][^'"`]+['"`]/g
        }
      },
      coverage: {
        required: false,
        checks: {
          testPositiveCases: /it\s*\(['"`][^'"`]*should[^'"`]*['"`]/gi,
          testNegativeCases: /it\s*\(['"`][^'"`]*(?:should not|throws|fails)[^'"`]*['"`]/gi,
          testEdgeCases: /it\s*\(['"`][^'"`]*(?:edge|boundary|limit)[^'"`]*['"`]/gi
        }
      }
    }
  },

  /**
   * Documentation Schema
   */
  documentation: {
    outputType: 'documentation',
    language: 'markdown',
    validationRules: {
      structure: {
        required: true,
        patterns: {
          hasHeaders: /^#+\s+/m,
          hasCodeBlocks: /```[\s\S]*?```/,
          hasLinks: /\[([^\]]+)\]\(([^)]+)\)/,
          hasLists: /^[\s]*[-*+]\s+/m
        }
      },
      quality: {
        required: true,
        checks: {
          minLength: 100,
          hasExamples: /```|`[^`]+`/,
          hasTable: /\|.*\|/,
          noTodos: /^(?!.*TODO|.*FIXME).*/gi
        }
      },
      accessibility: {
        required: false,
        patterns: {
          altTextForImages: /!\[[^\]]*\]/,
          descriptiveLinks: /\[[^\]]{3,}\]/
        }
      }
    }
  }
};

/**
 * Schema-based validation function
 */
export function validateBySchema(content, schemaName, options = {}) {
  const schema = LLM_OUTPUT_SCHEMAS[schemaName];
  if (!schema) {
    throw new Error(`Unknown schema: ${schemaName}`);
  }

  const {
    strictMode = false,
    performanceThreshold = 100,
    skipSecurity = false,
    skipQuality = false
  } = options;

  const startTime = performance.now();
  const results = {
    isValid: true,
    errors: [],
    warnings: [],
    securityIssues: [],
    qualityIssues: [],
    schemaName,
    performanceMs: 0
  };

  try {
    // Use comprehensive LLM validation
    const validation = validateLLMOutput(content, schema.outputType, {
      language: schema.language,
      securityLevel: 'high',
      validationLevel: strictMode ? 'strict' : 'basic',
      enforcesSacredPrinciples: true
    });

    // Merge basic validation results
    results.errors.push(...validation.errors);
    results.warnings.push(...validation.warnings);
    results.securityIssues.push(...validation.securityIssues);

    // Apply schema-specific validation rules
    if (schema.validationRules) {
      const schemaValidation = validateSchemaRules(content, schema.validationRules, {
        skipSecurity,
        skipQuality,
        strictMode
      });

      results.errors.push(...schemaValidation.errors);
      results.warnings.push(...schemaValidation.warnings);
      results.securityIssues.push(...schemaValidation.securityIssues);
      results.qualityIssues.push(...schemaValidation.qualityIssues);
    }

    results.isValid = results.errors.length === 0;
    results.performanceMs = performance.now() - startTime;

    // Check performance threshold
    if (results.performanceMs > performanceThreshold) {
      results.warnings.push({
        code: 'PERFORMANCE_THRESHOLD_EXCEEDED',
        message: `Validation exceeded ${performanceThreshold}ms threshold`
      });
    }

    return results;
  } catch (error) {
    return {
      isValid: false,
      errors: [{ code: 'SCHEMA_VALIDATION_ERROR', message: error.message }],
      warnings: [],
      securityIssues: [],
      qualityIssues: [],
      schemaName,
      performanceMs: performance.now() - startTime
    };
  }
}

/**
 * Validate content against schema-specific rules
 */
function validateSchemaRules(content, rules, options = {}) {
  const results = {
    errors: [],
    warnings: [],
    securityIssues: [],
    qualityIssues: []
  };

  // Validate syntax rules
  if (rules.syntax) {
    const syntaxResults = validateSyntaxRules(content, rules.syntax);
    results.errors.push(...syntaxResults.errors);
    results.warnings.push(...syntaxResults.warnings);
  }

  // Validate structure rules
  if (rules.structure) {
    const structureResults = validateStructureRules(content, rules.structure);
    results.errors.push(...structureResults.errors);
    results.warnings.push(...structureResults.warnings);
  }

  // Validate security rules (unless skipped)
  if (rules.security && !options.skipSecurity) {
    const securityResults = validateSecurityRules(content, rules.security);
    results.securityIssues.push(...securityResults.issues);
    if (options.strictMode) {
      results.errors.push(...securityResults.criticalIssues);
    }
  }

  // Validate quality rules (unless skipped)
  if (rules.quality && !options.skipQuality) {
    const qualityResults = validateQualityRules(content, rules.quality);
    results.qualityIssues.push(...qualityResults.issues);
    if (options.strictMode) {
      results.errors.push(...qualityResults.criticalIssues);
    } else {
      results.warnings.push(...qualityResults.issues);
    }
  }

  // Validate accessibility rules
  if (rules.accessibility) {
    const accessibilityResults = validateAccessibilityRules(content, rules.accessibility);
    results.warnings.push(...accessibilityResults.warnings);
    if (options.strictMode) {
      results.errors.push(...accessibilityResults.errors);
    }
  }

  return results;
}

/**
 * Validate syntax rules
 */
function validateSyntaxRules(content, syntaxRules) {
  const results = { errors: [], warnings: [] };

  if (syntaxRules.patterns) {
    Object.entries(syntaxRules.patterns).forEach(([name, pattern]) => {
      if (!pattern.test(content)) {
        results.errors.push({
          code: `SYNTAX_${name.toUpperCase()}_FAILED`,
          message: `Content failed ${name} syntax validation`
        });
      }
    });
  }

  return results;
}

/**
 * Validate structure rules
 */
function validateStructureRules(content, structureRules) {
  const results = { errors: [], warnings: [] };

  if (structureRules.patterns) {
    Object.entries(structureRules.patterns).forEach(([name, pattern]) => {
      if (!pattern.test(content)) {
        const issue = {
          code: `STRUCTURE_${name.toUpperCase()}_MISSING`,
          message: `Content missing required ${name} structure`
        };

        if (structureRules.required) {
          results.errors.push(issue);
        } else {
          results.warnings.push(issue);
        }
      }
    });
  }

  if (structureRules.checks) {
    // Handle JSON validation
    if (structureRules.checks.validJSON) {
      try {
        JSON.parse(content);
      } catch (error) {
        results.errors.push({
          code: 'INVALID_JSON_STRUCTURE',
          message: `Invalid JSON: ${error.message}`
        });
      }
    }

    // Handle required fields
    if (structureRules.checks.hasDataOrError) {
      try {
        const parsed = JSON.parse(content);
        const hasRequired = structureRules.checks.hasDataOrError.some(field =>
          parsed.hasOwnProperty(field);
        );
        if (!hasRequired) {
          results.errors.push({
            code: 'MISSING_REQUIRED_FIELDS',
            message: `Must contain one of: ${structureRules.checks.hasDataOrError.join(', ')}`
          });
        }
      } catch (error) {
        // JSON parsing already handled above
      }
    }
  }

  return results;
}

/**
 * Validate security rules
 */
function validateSecurityRules(content, securityRules) {
  const results = { issues: [], criticalIssues: [] };

  // Check forbidden patterns
  if (securityRules.forbiddenPatterns) {
    securityRules.forbiddenPatterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        const issue = {
          code: `SECURITY_FORBIDDEN_PATTERN_${index}`,
          message: `Content contains forbidden security pattern`,
          severity: 'high'
        };
        results.issues.push(issue);
      }
    });
  }

  // Check for sensitive keys
  if (securityRules.sensitiveKeys) {
    securityRules.sensitiveKeys.forEach(key => {
      const pattern = new RegExp(`['']?${key}['']?\\s*[=:]\\s*[''][^'']+["']`, 'gi');
      if (pattern.test(content)) {
        const issue = {
          code: 'SENSITIVE_DATA_EXPOSED',
          message: `Potential sensitive data exposure: ${key}`,
          severity: 'critical'
        };
        results.criticalIssues.push(issue);
      }
    });
  }

  // Check forbidden fields in JSON
  if (securityRules.forbiddenFields) {
    try {
      const parsed = JSON.parse(content);
      const checkObject = (obj, path = '') => {
        Object.keys(obj).forEach(key => {
          if (securityRules.forbiddenFields.includes(key)) {
            results.criticalIssues.push({
              code: 'FORBIDDEN_FIELD_PRESENT',
              message: `Forbidden field '${key}' found at ${path || 'root'}`,
              severity: 'critical'
            });
          }
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            checkObject(obj[key], path ? `${path}.${key}` : key);
          }
        });
      };
      checkObject(parsed);
    } catch (error) {
      // Not JSON, skip this check
    }
  }

  return results;
}

/**
 * Validate quality rules
 */
function validateQualityRules(content, qualityRules) {
  const results = { issues: [], criticalIssues: [] };

  if (qualityRules.checks) {
    Object.entries(qualityRules.checks).forEach(([check, requirement]) => {
      switch (check) {
        case 'minLength':
          if (content.length < requirement) {
            results.issues.push({
              code: 'CONTENT_TOO_SHORT',
              message: `Content too short: ${content.length} < ${requirement} characters`
            });
          }
          break;

        case 'hasExamples':
          if (!requirement.test(content)) {
            results.issues.push({
              code: 'MISSING_EXAMPLES',
              message: 'Content should include code examples'
            });
          }
          break;

        case 'noTodos':
          if (!requirement.test(content)) {
            results.criticalIssues.push({
              code: 'INCOMPLETE_CONTENT',
              message: 'Content contains TODO or FIXME markers'
            });
          }
          break;
      }
    });
  }

  return results;
}

/**
 * Validate accessibility rules
 */
function validateAccessibilityRules(content, accessibilityRules) {
  const results = { errors: [], warnings: [] };

  if (accessibilityRules.patterns) {
    Object.entries(accessibilityRules.patterns).forEach(([name, pattern]) => {
      if (!pattern.test(content)) {
        results.warnings.push({
          code: `ACCESSIBILITY_${name.toUpperCase()}_MISSING`,
          message: `Content lacks ${name} for better accessibility`
        });
      }
    });
  }

  return results;
}

/**
 * Binary validation function using schemas
 */
export function binaryValidateBySchema(content, schemaName, options = {}) {
  const startTime = performance.now();

  try {
    const validation = validateBySchema(content, schemaName, {
      ...options,
      performanceThreshold: options.performanceThreshold || 50 // Faster for binary checks
    });

    return {
      isValid: validation.isValid,
      hasSecurityIssues: validation.securityIssues.length > 0,
      hasQualityIssues: validation.qualityIssues.length > 0,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      performanceMs: performance.now() - startTime,
      withinThreshold: validation.performanceMs <= (options.performanceThreshold || 50),
      schemaName
    };
  } catch (error) {
    return {
      isValid: false,
      hasSecurityIssues: true,
      hasQualityIssues: true,
      errorCount: 1,
      warningCount: 0,
      performanceMs: performance.now() - startTime,
      withinThreshold: false,
      schemaName,
      error: error.message
    };
  }
}

/**
 * Get available schema names
 */
export function getAvailableSchemas() {
  return Object.keys(LLM_OUTPUT_SCHEMAS);
}

/**
 * Get schema definition by name
 */
export function getSchema(schemaName) {
  return LLM_OUTPUT_SCHEMAS[schemaName] || null;
}

/**
 * Validate multiple outputs in batch
 */
export async function batchValidate(validations, options = {}) {
  const { concurrency = 3, failFast = false } = options;
  const results = [];

  // Process validations in batches
  for (let i = 0; i < validations.length; i += concurrency) {
    const batch = validations.slice(i, i + concurrency);

    const batchPromises = batch.map(async (validation) => {
      try {
        const result = await validateBySchema(
          validation.content,
          validation.schemaName,
          validation.options || {}
        );
        return { ...result, index: validation.index || i };
      } catch (error) {
        return {
          isValid: false,
          errors: [{ code: 'BATCH_VALIDATION_ERROR', message: error.message }],
          index: validation.index || i,
          schemaName: validation.schemaName
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Fail fast if any validation fails
    if (failFast && batchResults.some(result => !result.isValid)) {
      break;
    }
  }

  return {
    results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.isValid).length,
      failed: results.filter(r => !r.isValid).length,
      avgPerformance: results.reduce((acc, r) => acc + (r.performanceMs || 0), 0) / results.length
    }
  };
}

/**
 * API endpoint for LLM output validation
 * Provides binary validation with real-time feedback
 */

import { validateLLMOutput, binaryValidate } from '../../../lib/collaboration/validation.js';
import { validateBySchema, getAvailableSchemas } from '../../../lib/collaboration/llm-schemas.js';
import { withErrorHandler } from '../../../lib/collaboration/error-handler.js';

async function handler(req, res) {
  switch (req.method) {
    case 'POST':
      return await handleValidation(req, res);
    case 'GET':
      return await handleGetInfo(req, res);
    default:
      return res.status(405).json({
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Only POST and GET methods are allowed'
        }
      });
  }
}

/**
 * Handle validation requests
 */
async function handleValidation(req, res) {
  const {
    content,
    outputType = 'code',
    language = null,
    schemaName = null,
    validationType = 'comprehensive', // 'binary', 'schema', 'comprehensive'
    securityLevel = 'medium',
    validationLevel = 'strict',
    enforcesSacredPrinciples = false,
    performanceThreshold = 100,
    strictMode = false
  } = req.body;

  // Input validation
  if (!content || typeof content !== 'string') {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'Content is required and must be a string'
      }
    });
  }

  if (content.length > 1000000) { // 1MB limit
    return res.status(400).json({
      error: {
        code: 'CONTENT_TOO_LARGE',
        message: 'Content exceeds 1MB limit'
      }
    });
  }

  try {
    let validationResult;
    const validationStartTime = Date.now();

    switch (validationType) {
      case 'binary':
        validationResult = binaryValidate(content, outputType, {
          strictMode,
          performanceThreshold
        });
        break;

      case 'schema':
        if (!schemaName) {
          return res.status(400).json({
            error: {
              code: 'SCHEMA_NAME_REQUIRED',
              message: 'Schema name is required for schema validation'
            }
          });
        }
        validationResult = await validateBySchema(content, schemaName, {
          strictMode,
          performanceThreshold
        });
        break;

      case 'comprehensive':
      default:
        validationResult = validateLLMOutput(content, outputType, {
          language,
          securityLevel,
          validationLevel,
          enforcesSacredPrinciples
        });
        break;
    }

    const totalProcessingTime = Date.now() - validationStartTime;

    // Add metadata
    const response = {
      data: {
        validation: validationResult,
        metadata: {
          validationType,
          processingTimeMs: totalProcessingTime,
          contentLength: content.length,
          timestamp: new Date().toISOString(),
          performanceTarget: performanceThreshold,
          withinTarget: totalProcessingTime <= performanceThreshold
        }
      },
      error: null
    };

    // Check if performance target exceeded
    if (totalProcessingTime > performanceThreshold) {
      response.data.metadata.performanceWarning =
        `Validation took ${totalProcessingTime}ms, exceeding target of ${performanceThreshold}ms`;
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('LLM validation error:', error);

    return res.status(500).json({
      error: {
        code: 'VALIDATION_PROCESSING_ERROR',
        message: 'Failed to process validation request',
        details: {
          error: error.message,
          validationType,
          contentLength: content.length
        }
      }
    });
  }
}

/**
 * Handle info requests
 */
async function handleGetInfo(req, res) {
  const { type } = req.query;

  try {
    switch (type) {
      case 'schemas':
        return res.status(200).json({
          data: {
            availableSchemas: getAvailableSchemas(),
            description: 'Available schema names for validation'
          },
          error: null
        });

      case 'performance':
        // Get performance stats from validation system
        const { validationFeedback } = await import('../../../lib/collaboration/validation.js');
        const stats = validationFeedback.getPerformanceStats();

        return res.status(200).json({
          data: {
            performance: stats,
            description: 'Current validation performance statistics'
          },
          error: null
        });

      case 'capabilities':
      default:
        return res.status(200).json({
          data: {
            validationTypes: ['binary', 'schema', 'comprehensive'],
            outputTypes: ['code', 'documentation', 'ui-component', 'api-response', 'config', 'test', 'schema'],
            languages: ['javascript', 'typescript', 'python', 'html', 'css', 'json', 'yaml', 'markdown', 'jsx', 'tsx'],
            securityLevels: ['low', 'medium', 'high', 'critical'],
            validationLevels: ['basic', 'strict', 'sacred'],
            performanceTarget: '< 100ms',
            features: [
              'Binary pass/fail validation',
              'Real-time feedback',
              'Security vulnerability detection',
              'Sacred principles enforcement',
              'Schema-based validation',
              'Performance monitoring',
              'Batch validation support'
            ]
          },
          error: null
        });
    }
  } catch (error) {
    console.error('Info request error:', error);

    return res.status(500).json({
      error: {
        code: 'INFO_REQUEST_ERROR',
        message: 'Failed to retrieve information',
        details: error.message
      }
    });
  }
}

// Export with error handling
export default withErrorHandler(handler);

/**
 * Batch validation endpoint
 */
export async function batchValidationHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST method is allowed'
      }
    });
  }

  const {
    validations = [],
    options = {}
  } = req.body;

  if (!Array.isArray(validations) || validations.length === 0) {
    return res.status(400).json({
      error: {
        code: 'INVALID_BATCH_INPUT',
        message: 'Validations must be a non-empty array'
      }
    });
  }

  if (validations.length > 50) {
    return res.status(400).json({
      error: {
        code: 'BATCH_TOO_LARGE',
        message: 'Batch size cannot exceed 50 validations'
      }
    });
  }

  try {
    const { batchValidate } = await import('../../../lib/collaboration/llm-schemas.js');
    const results = await batchValidate(validations, options);

    return res.status(200).json({
      data: results,
      error: null
    });

  } catch (error) {
    console.error('Batch validation error:', error);

    return res.status(500).json({
      error: {
        code: 'BATCH_VALIDATION_ERROR',
        message: 'Failed to process batch validation',
        details: error.message
      }
    });
  }
}

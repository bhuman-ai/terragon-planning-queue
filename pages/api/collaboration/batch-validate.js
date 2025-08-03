/**
 * Batch validation endpoint for multiple LLM outputs
 * Optimized for high-throughput validation scenarios
 */

import { batchValidate } from '../../../lib/collaboration/llm-schemas.js';
import { withErrorHandler } from '../../../lib/collaboration/error-handler.js';

async function handler(req, res) {
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

  // Input validation
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

  // Validate each item in the batch
  for (let i = 0; i < validations.length; i++) {
    const validation = validations[i];
    
    if (!validation.content || typeof validation.content !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_VALIDATION_ITEM',
          message: `Validation item ${i} missing or invalid content`
        }
      });
    }

    if (!validation.schemaName) {
      return res.status(400).json({
        error: {
          code: 'MISSING_SCHEMA_NAME',
          message: `Validation item ${i} missing schemaName`
        }
      });
    }

    if (validation.content.length > 1000000) {
      return res.status(400).json({
        error: {
          code: 'CONTENT_TOO_LARGE',
          message: `Validation item ${i} content exceeds 1MB limit`
        }
      });
    }
  }

  try {
    const startTime = Date.now();
    
    const results = await batchValidate(validations, {
      concurrency: options.concurrency || 5,
      failFast: options.failFast || false,
      ...options
    });

    const processingTime = Date.now() - startTime;

    return res.status(200).json({
      data: {
        ...results,
        metadata: {
          processingTimeMs: processingTime,
          totalItems: validations.length,
          averageTimePerItem: processingTime / validations.length,
          timestamp: new Date().toISOString()
        }
      },
      error: null
    });

  } catch (error) {
    console.error('Batch validation error:', error);
    
    return res.status(500).json({
      error: {
        code: 'BATCH_VALIDATION_ERROR',
        message: 'Failed to process batch validation',
        details: {
          error: error.message,
          batchSize: validations.length
        }
      }
    });
  }
}

export default withErrorHandler(handler);
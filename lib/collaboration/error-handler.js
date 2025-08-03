/**
 * Centralized error handling for collaboration system
 * Provides consistent error responses and logging
 */

import { kv } from '@vercel/kv';

// Error types and their handling strategies
const ERROR_TYPES = {
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    logLevel: 'warn',
    userMessage: 'The provided data failed validation'
  },
  AUTHENTICATION_ERROR: {
    code: 'AUTHENTICATION_ERROR',
    statusCode: 401,
    logLevel: 'warn',
    userMessage: 'Authentication failed'
  },
  AUTHORIZATION_ERROR: {
    code: 'AUTHORIZATION_ERROR',
    statusCode: 403,
    logLevel: 'warn',
    userMessage: 'Access denied'
  },
  NOT_FOUND_ERROR: {
    code: 'NOT_FOUND_ERROR',
    statusCode: 404,
    logLevel: 'info',
    userMessage: 'The requested resource was not found'
  },
  CONFLICT_ERROR: {
    code: 'CONFLICT_ERROR',
    statusCode: 409,
    logLevel: 'warn',
    userMessage: 'The request conflicts with the current state'
  },
  SACRED_VIOLATION_ERROR: {
    code: 'SACRED_VIOLATION_ERROR',
    statusCode: 422,
    logLevel: 'error',
    userMessage: 'Operation violates sacred document principles'
  },
  CHECKPOINT_ERROR: {
    code: 'CHECKPOINT_ERROR',
    statusCode: 500,
    logLevel: 'error',
    userMessage: 'Checkpoint operation failed'
  },
  SYNC_ERROR: {
    code: 'SYNC_ERROR',
    statusCode: 500,
    logLevel: 'error',
    userMessage: 'State synchronization failed'
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    logLevel: 'error',
    userMessage: 'An internal error occurred'
  }
};

/**
 * Custom error class for collaboration system
 */
export class CollaborationError extends Error {
  constructor(type, message, details = null, context = {}) {
    super(message);
    this.name = 'CollaborationError';
    this.type = type;
    this.details = details;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Get error configuration
    this.config = ERROR_TYPES[type] || ERROR_TYPES.INTERNAL_ERROR;
  }

  toJSON() {
    return {
      error: {
        code: this.config.code,
        message: this.config.userMessage,
        details: this.details,
        timestamp: this.timestamp,
        context: this.context
      }
    };
  }
}

/**
 * Error handler middleware for API routes
 */
export function withErrorHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      await handleError(error, req, res);
    }
  };
}

/**
 * Handle and respond to errors
 */
export async function handleError(error, req, res) {
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  let collaborationError;
  if (error instanceof CollaborationError) {
    collaborationError = error;
  } else {
    // Wrap unknown errors
    collaborationError = new CollaborationError(
      'INTERNAL_ERROR',
      error.message,
      { originalError: error.name },
      { errorId }
    );
  }

  // Log error with appropriate level
  const logData = {
    errorId,
    type: collaborationError.type,
    message: collaborationError.message,
    details: collaborationError.details,
    context: collaborationError.context,
    url: req.url,
    method: req.method,
    timestamp: collaborationError.timestamp,
    stack: error.stack
  };

  switch (collaborationError.config.logLevel) {
    case 'error':
      console.error('Collaboration Error:', logData);
      break;
    case 'warn':
      console.warn('Collaboration Warning:', logData);
      break;
    case 'info':
      console.info('Collaboration Info:', logData);
      break;
    default:
      console.log('Collaboration Log:', logData);
  }

  // Store error for debugging (don't await to avoid blocking response)
  storeError(errorId, logData).catch(console.error);

  // Send response
  if (!res.headersSent) {
    const responseData = collaborationError.toJSON();
    responseData.error.errorId = errorId;

    res.status(collaborationError.config.statusCode).json(responseData);
  }
}

/**
 * Store error for debugging and monitoring
 */
async function storeError(errorId, errorData) {
  try {
    await kv.set(`collaboration:error:${errorId}`, errorData, {
      ex: 3600 * 24 * 7 // 7 days expiry
    });
  } catch (storeError) {
    console.error("Failed to store error:', storeError);
  }
}

/**
 * Validation error helpers
 */
export function createValidationError(field, message, value = null) {
  return new CollaborationError(
    'VALIDATION_ERROR',
    `Validation failed for field: ${field}`,
    { field, message, value }
  );
}

export function createAuthenticationError(reason = 'Invalid authentication') {
  return new CollaborationError(
    'AUTHENTICATION_ERROR',
    reason;
  );
}

export function createNotFoundError(resource, id = null) {
  return new CollaborationError(
    'NOT_FOUND_ERROR',
    `${resource} not found`,
    { resource, id }
  );
}

export function createConflictError(message, conflicts = []) {
  return new CollaborationError(
    'CONFLICT_ERROR',
    message,
    { conflicts }
  );
}

export function createSacredViolationError(violations = []) {
  return new CollaborationError(
    'SACRED_VIOLATION_ERROR',
    'Operation violates sacred document principles',
    { violations }
  );
}

export function createCheckpointError(operation, reason) {
  return new CollaborationError(
    'CHECKPOINT_ERROR',
    `Checkpoint ${operation} failed: ${reason}`,
    { operation, reason }
  );
}

export function createSyncError(reason, sessionId = null) {
  return new CollaborationError(
    'SYNC_ERROR',
    `State synchronization failed: ${reason}`,
    { reason, sessionId }
  );
}

/**
 * Error recovery helpers
 */
export async function withRetry(operation, maxRetries = 3, delay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
    }
  }

  throw lastError;
}

/**
 * Circuit breaker for external services
 */
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CollaborationError(
          'INTERNAL_ERROR',
          'Circuit breaker is open - service unavailable';
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}

// Export circuit breaker instance for external services
export const externalServiceBreaker = new CircuitBreaker();

/**
 * Graceful degradation helper
 */
export async function withGracefulDegradation(primaryOperation, fallbackOperation, context = {}) {
  try {
    return await primaryOperation();
  } catch (error) {
    console.warn('Primary operation failed, using fallback:', { error: error.message, context });

    try {
      return await fallbackOperation();
    } catch (fallbackError) {
      console.error('Fallback operation also failed:', { error: fallbackError.message, context });
      throw error; // Throw original error
    }
  }
}

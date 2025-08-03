/**
 * Comprehensive validation system for collaboration APIs
 */

import { CollaborationError, createValidationError } from './error-handler';

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
  }
};

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
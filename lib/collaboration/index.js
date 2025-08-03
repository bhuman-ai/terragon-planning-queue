/**
 * Collaboration System - Main entry point
 * Exports all collaboration functionality for easy import
 */

// Error handling
export {
  CollaborationError,
  withErrorHandler,
  handleError,
  createValidationError,
  createAuthenticationError,
  createNotFoundError,
  createConflictError,
  createSacredViolationError,
  createCheckpointError,
  createSyncError,
  withRetry,
  externalServiceBreaker,
  withGracefulDegradation
} from './error-handler';

// Validation
export {
  validateRequest,
  validateQueryParams,
  validatePagination,
  validateContent,
  validateRateLimit,
  withValidation,
  SCHEMAS
} from './validation';

// Re-export WebSocket utilities
export {
  activeConnections,
  broadcastToSession,
  sendSSEMessage
} from '../pages/api/collaboration/sync/websocket';

// System constants
export const COLLABORATION_CONFIG = {
  // Session configuration
  SESSION_EXPIRY: 3600 * 24, // 24 hours
  SESSION_PREFIX: 'collaboration:session:',

  // Draft configuration
  DRAFT_EXPIRY: 3600 * 24 * 7, // 7 days
  DRAFT_PREFIX: 'collaboration:draft:',
  MAX_DRAFT_SIZE: 1000000, // 1MB
  MAX_VERSION_HISTORY: 50,

  // Checkpoint configuration
  CHECKPOINT_EXPIRY: 3600 * 24 * 7, // 7 days
  CHECKPOINT_PREFIX: 'collaboration:checkpoint:',
  MAX_CHECKPOINT_RETENTION: 100,

  // Merge configuration
  MERGE_EXPIRY: 3600 * 24 * 7, // 7 days
  MERGE_PREFIX: 'collaboration:merge:',

  // Error storage
  ERROR_EXPIRY: 3600 * 24 * 7, // 7 days
  ERROR_PREFIX: 'collaboration:error:',

  // Rate limiting
  RATE_LIMITS: {
    'create-draft': { max: 100, window: 3600 },
    'update-draft': { max: 500, window: 3600 },
    'create-checkpoint': { max: 50, window: 3600 },
    'meta-agent': { max: 200, window: 3600 },
    'sync-state': { max: 1000, window: 3600 }
  },

  // WebSocket configuration
  WEBSOCKET: {
    HEARTBEAT_INTERVAL: 30000, // 30 seconds
    CONNECTION_TIMEOUT: 300000, // 5 minutes
    MAX_CONNECTIONS_PER_SESSION: 10
  },

  // Conflict resolution
  CONFLICT_DETECTION: {
    THRESHOLD_LOW: 0.1,
    THRESHOLD_MEDIUM: 0.3,
    THRESHOLD_HIGH: 0.7,
    SACRED_SECTIONS: [
      'Sacred Principles',
      'ABSOLUTE RULES',
      'Deployment Target',
      'Team Account'
    ]
  }
};

/**
 * Health check function for collaboration system
 */
export async function getSystemHealth() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      kv: 'unknown',
      metaAgent: 'unknown',
      security: 'unknown',
      websocket: 'unknown'
    },
    metrics: {
      activeSessions: 0,
      totalDrafts: 0,
      totalCheckpoints: 0,
      activeConnections: 0
    }
  };

  try {
    // Check KV store
    const { kv } = await import('@vercel/kv');
    await kv.ping();
    health.services.kv = 'healthy';
  } catch (error) {
    health.services.kv = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    // Check MetaAgent
    const MetaAgent = (await import('../meta-agent')).default;
    const metaAgent = new MetaAgent({ enabled: true });
    health.services.metaAgent = 'healthy';
  } catch (error) {
    health.services.metaAgent = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    // Check security system
    const { verifyAgentAuth } = await import('../security/agent-auth');
    health.services.security = 'healthy';
  } catch (error) {
    health.services.security = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    // Check WebSocket connections
    const { activeConnections } = await import('../../pages/api/collaboration/sync/websocket');
    health.services.websocket = 'healthy';
    health.metrics.activeConnections = activeConnections.size;
  } catch (error) {
    health.services.websocket = 'unhealthy';
  }

  return health;
}

/**
 * Utility functions for collaboration system
 */
export const CollaborationUtils = {
  // Generate unique IDs
  generateSessionId() {
    return `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  generateDraftId() {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  generateCheckpointId() {
    return `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  },

  generateMergeId() {
    return `merge_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  },

  // Content utilities
  calculateContentStats(content) {
    if (!content || typeof content !== 'string') {
      return {
        wordCount: 0,
        characterCount: 0,
        lineCount: 0,
        estimatedReadingTime: 0
      };
    }

    const words = content.split(/\s+/).filter(w => w.length > 0);
    const lines = content.split('\n');

    return {
      wordCount: words.length,
      characterCount: content.length,
      lineCount: lines.length,
      estimatedReadingTime: Math.ceil(words.length / 200) // 200 WPM average
    };
  },

  // Hash content for integrity checking
  async hashContent(content) {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  },

  // Format timestamps
  formatTimestamp(timestamp) {
    return new Date(timestamp).toISOString();
  },

  // Sanitize user input
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    // Basic sanitization - remove potentially dangerous characters
    return input
      .replace(/[<>"'&]/g, '') // Remove HTML-like characters
      .trim();
      .substring(0, 10000); // Limit length
  },

  // Check if content contains sacred sections
  containsSacredContent(content) {
    const sacredPatterns = [
      /^##\s+\d+\.\s+Sacred/im,
      /^\*\*ABSOLUTE RULES/im,
      /deployment target/im,
      /team account/im;
    ];

    return sacredPatterns.some(pattern => pattern.test(content));
  },

  // Extract sections from content
  extractSections(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;

    lines.forEach((line, index) => {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headerMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          level: headerMatch[1].length,
          title: headerMatch[2],
          startLine: index + 1,
          content: []
        };
      } else if (currentSection) {
        currentSection.content.push(line);
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }
};

// Export default configuration
export default {
  config: COLLABORATION_CONFIG,
  utils: CollaborationUtils,
  getSystemHealth
};

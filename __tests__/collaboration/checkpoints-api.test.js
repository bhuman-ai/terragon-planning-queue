/**
 * Unit Tests for Collaboration Checkpoints API
 * Tests checkpoint creation, execution, monitoring, and atomic operations
 */

import { createMocks } from 'node-mocks-http';
import checkpointCreateHandler from '../../pages/api/collaboration/checkpoints/create';
import checkpointExecuteHandler from '../../pages/api/collaboration/checkpoints/execute';
import checkpointMonitorHandler from '../../pages/api/collaboration/checkpoints/monitor';

// Mock dependencies
jest.mock('@vercel/kv');
jest.mock('../../lib/security/agent-auth');
jest.mock('../../lib/security/atomic-checkpoints');

describe('Collaboration Checkpoints API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/collaboration/checkpoints/create', () => {
    test('should create checkpoint successfully with valid data', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default;

      // Setup mocks
      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockResolvedValue(undefined),
        createCheckpoint: jest.fn().mockResolvedValue({
          checkpointId: 'atomic-checkpoint-123',
          filesBackedUp: 2,
          timestamp: '2022-01-01T00:00:00.000Z'
        })
      };

      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints);

      const sessionData = {
        sessionData: {
          execution: { checkpoints: [] }
        },
        lastAccessed: '2022-01-01T00:00:00.000Z'
      };

      kv.get.mockResolvedValue(sessionData);
      kv.set.mockResolvedValue('OK');

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token-123'
        },
        body: {
          sessionId: 'session-123',
          type: 'draft_backup',
          description: 'Backup before major revision',
          data: {
            draftId: 'draft-456',
            content: 'Draft content to backup'
          },
          filePaths: ['/test/claude.md', '/test/backup.md'],
          metadata: {
            priority: 'high',
            agent: 'meta-agent-001'
          }
        }
      });

      await checkpointCreateHandler(req, res);

      expect(res._getStatusCode()).toBe(201);
      const response = JSON.parse(res._getData());

      expect(response.checkpointId).toBe('atomic-checkpoint-123');
      expect(response.sessionId).toBe('session-123');
      expect(response.type).toBe('draft_backup');
      expect(response.description).toBe('Backup before major revision');
      expect(response.timestamp).toBeDefined();
      expect(response.status).toBe('created');
      expect(response.metadata.filesBackedUp).toBe(2);

      // Verify atomic checkpoint system was used
      expect(mockAtomicCheckpoints.initialize).toHaveBeenCalled();
      expect(mockAtomicCheckpoints.createCheckpoint).toHaveBeenCalledWith(
        'draft_backup: Backup before major revision',
        ['/test/claude.md', '/test/backup.md']
      );

      // Verify checkpoint was stored in KV
      expect(kv.set).toHaveBeenCalledWith(
        'collaboration:checkpoint:atomic-checkpoint-123',
        expect.objectContaining({
          id: 'atomic-checkpoint-123',
          sessionId: 'session-123',
          type: 'draft_backup',
          description: 'Backup before major revision'
        }),
        { ex: 3600 * 24 * 7 }
      );
    });

    test('should reject requests without agent authentication', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(false);

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'invalid-token'
        },
        body: {
          sessionId: 'session-123',
          type: 'test',
          description: 'Test checkpoint'
        }
      });

      await checkpointCreateHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Invalid agent authentication');
    });

    test('should reject requests with missing required fields', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(true);

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123'
          // Missing type and description
        }
      });

      await checkpointCreateHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Missing required fields: sessionId, type, description');
    });

    test('should reject checkpoint creation for non-existent session', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');

      verifyAgentAuth.validateToken.mockReturnValue(true);
      kv.get.mockResolvedValue(null); // Session not found

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'nonexistent-session',
          type: 'test',
          description: 'Test checkpoint'
        }
      });

      await checkpointCreateHandler(req, res);

      expect(res._getStatusCode()).toBe(404);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Session not found');
    });

    test('should update session with checkpoint reference', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default;

      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockResolvedValue(undefined),
        createCheckpoint: jest.fn().mockResolvedValue({
          checkpointId: 'checkpoint-456',
          filesBackedUp: 1
        })
      };

      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints);

      const sessionData = {
        sessionData: {
          execution: {
            checkpoints: [
              { id: 'old-checkpoint-1', type: 'test' },
              { id: 'old-checkpoint-2', type: 'test' }
            ]
          }
        }
      };

      kv.get.mockResolvedValue(sessionData);
      kv.set.mockResolvedValue('OK');

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          type: 'new_checkpoint',
          description: 'New checkpoint'
        }
      });

      await checkpointCreateHandler(req, res);

      expect(res._getStatusCode()).toBe(201);

      // Verify session was updated with new checkpoint at the beginning
      const sessionUpdateCall = kv.set.mock.calls.find(call =>
        call[0] === 'collaboration:session:session-123'
      );
      expect(sessionUpdateCall).toBeDefined();

      const updatedSession = sessionUpdateCall[1];
      expect(updatedSession.sessionData.execution.checkpoints).toHaveLength(3);
      expect(updatedSession.sessionData.execution.checkpoints[0].id).toBe('checkpoint-456');
      expect(updatedSession.sessionData.execution.checkpoints[0].type).toBe('new_checkpoint');
    });

    test('should limit checkpoints in session to 50', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default;

      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockResolvedValue(undefined),
        createCheckpoint: jest.fn().mockResolvedValue({
          checkpointId: 'new-checkpoint',
          filesBackedUp: 0
        })
      };

      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints);

      // Create session with 50 existing checkpoints
      const existingCheckpoints = Array.from({ length: 50 }, (_, i) => ({
        id: `checkpoint-${i}`,
        type: 'test'
      }));

      const sessionData = {
        sessionData: {
          execution: { checkpoints: existingCheckpoints }
        }
      };

      kv.get.mockResolvedValue(sessionData);
      kv.set.mockResolvedValue('OK');

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          type: 'new_checkpoint',
          description: 'This should push out the oldest'
        }
      });

      await checkpointCreateHandler(req, res);

      expect(res._getStatusCode()).toBe(201);

      // Verify checkpoints are limited to 50
      const sessionUpdateCall = kv.set.mock.calls.find(call =>
        call[0] === 'collaboration:session:session-123'
      );
      const updatedSession = sessionUpdateCall[1];

      expect(updatedSession.sessionData.execution.checkpoints).toHaveLength(50);
      expect(updatedSession.sessionData.execution.checkpoints[0].id).toBe('new-checkpoint');
      expect(updatedSession.sessionData.execution.checkpoints[49].id).toBe('checkpoint-48'); // Oldest kept
    });

    test('should handle atomic checkpoint system errors', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default;

      verifyAgentAuth.validateToken.mockReturnValue(true);
      kv.get.mockResolvedValue({
        sessionData: { execution: { checkpoints: [] } }
      });

      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockResolvedValue(undefined),
        createCheckpoint: jest.fn().mockRejectedValue(new Error('Atomic checkpoint failed'))
      };

      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints);

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          type: 'test',
          description: 'Test error handling'
        }
      });

      await checkpointCreateHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Failed to create checkpoint');
      expect(response.details).toBe('Atomic checkpoint failed');
    });

    test('should reject non-POST methods', async () => {
      const { req, res } = createMocks({
        method: 'GET'
      });

      await checkpointCreateHandler(req, res);

      expect(res._getStatusCode()).toBe(405);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Method not allowed');
    });
  });

  describe('POST /api/collaboration/checkpoints/execute', () => {
    test('should execute checkpoint rollback successfully', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default;

      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockResolvedValue(undefined),
        rollbackToCheckpoint: jest.fn().mockResolvedValue({
          success: true,
          checkpointId: 'checkpoint-123',
          filesRestored: 3
        })
      };

      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints);

      const checkpointData = {
        id: 'checkpoint-123',
        sessionId: 'session-123',
        type: 'draft_backup',
        status: 'created'
      };

      kv.get.mockResolvedValue(checkpointData);
      kv.set.mockResolvedValue('OK');

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          checkpointId: 'checkpoint-123',
          action: 'rollback',
          reason: 'Reverting due to critical error'
        }
      });

      await checkpointExecuteHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      expect(response.checkpointId).toBe('checkpoint-123');
      expect(response.action).toBe('rollback');
      expect(response.success).toBe(true);
      expect(response.filesRestored).toBe(3);
      expect(response.timestamp).toBeDefined();

      // Verify checkpoint was executed
      expect(mockAtomicCheckpoints.rollbackToCheckpoint).toHaveBeenCalledWith('checkpoint-123');

      // Verify checkpoint status was updated
      expect(kv.set).toHaveBeenCalledWith(
        'collaboration:checkpoint:checkpoint-123',
        expect.objectContaining({
          status: 'executed',
          executedAt: expect.any(String),
          action: 'rollback'
        }),
        { ex: 3600 * 24 * 7 }
      );
    });

    test('should handle checkpoint verification action', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default;

      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockResolvedValue(undefined),
        markCheckpointSuccessful: jest.fn().mockResolvedValue({
          success: true,
          checkpointId: 'checkpoint-456'
        })
      };

      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints);

      const checkpointData = {
        id: 'checkpoint-456',
        sessionId: 'session-123',
        status: 'created'
      };

      kv.get.mockResolvedValue(checkpointData);
      kv.set.mockResolvedValue('OK');

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          checkpointId: 'checkpoint-456',
          action: 'verify',
          reason: 'Confirming successful operation'
        }
      });

      await checkpointExecuteHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      expect(response.action).toBe('verify');
      expect(response.success).toBe(true);

      // Verify checkpoint was marked successful
      expect(mockAtomicCheckpoints.markCheckpointSuccessful).toHaveBeenCalledWith('checkpoint-456');
    });

    test('should reject execution of non-existent checkpoint', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');

      verifyAgentAuth.validateToken.mockReturnValue(true);
      kv.get.mockResolvedValue(null); // Checkpoint not found

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          checkpointId: 'nonexistent-checkpoint',
          action: 'rollback'
        }
      });

      await checkpointExecuteHandler(req, res);

      expect(res._getStatusCode()).toBe(404);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Checkpoint not found');
    });

    test('should reject invalid actions', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');

      verifyAgentAuth.validateToken.mockReturnValue(true);
      kv.get.mockResolvedValue({
        id: 'checkpoint-123',
        status: 'created'
      });

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          checkpointId: 'checkpoint-123',
          action: 'invalid-action'
        }
      });

      await checkpointExecuteHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Invalid action. Supported actions: rollback, verify');
    });

    test('should prevent execution of already executed checkpoints', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');

      verifyAgentAuth.validateToken.mockReturnValue(true);
      kv.get.mockResolvedValue({
        id: 'checkpoint-123',
        status: 'executed',
        executedAt: '2022-01-01T00:00:00.000Z'
      });

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          checkpointId: 'checkpoint-123',
          action: 'rollback'
        }
      });

      await checkpointExecuteHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Checkpoint has already been executed');
    });
  });

  describe('GET /api/collaboration/checkpoints/monitor', () => {
    test('should return checkpoint status and metrics', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default;

      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getStatus: jest.fn().mockResolvedValue({
          timestamp: '2022-01-01T00:00:00.000Z',
          checkpoints: {
            total: 15,
            lastId: 15
          },
          transactions: {
            total: 8,
            lastId: 8,
            active: 2
          },
          locks: {
            active: 1
          },
          system: {
            pid: 12345,
            uptime: 3600,
            memory: {
              rss: 100000000,
              heapTotal: 50000000,
              heapUsed: 30000000
            }
          }
        })
      };

      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints);

      // Mock session data
      const sessionData = {
        sessionData: {
          execution: {
            checkpoints: [
              { id: 'cp-1', type: 'draft', status: 'created', timestamp: '2022-01-01T00:00:00.000Z' },
              { id: 'cp-2', type: 'merge', status: 'executed', timestamp: '2022-01-01T01:00:00.000Z' }
            ]
          }
        }
      };

      kv.get.mockResolvedValue(sessionData);

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          sessionId: 'session-123'
        }
      });

      await checkpointMonitorHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      expect(response.sessionId).toBe('session-123');
      expect(response.sessionCheckpoints).toHaveLength(2);
      expect(response.systemStatus.checkpoints.total).toBe(15);
      expect(response.systemStatus.transactions.active).toBe(2);
      expect(response.systemStatus.locks.active).toBe(1);
      expect(response.metrics).toBeDefined();
      expect(response.metrics.totalCreated).toBe(2);
      expect(response.metrics.totalExecuted).toBe(1);
      expect(response.metrics.executionRate).toBe(0.5);
    });

    test('should handle session without checkpoints', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default;

      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getStatus: jest.fn().mockResolvedValue({
          checkpoints: { total: 0 },
          transactions: { total: 0, active: 0 },
          locks: { active: 0 }
        })
      };

      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints);

      const sessionData = {
        sessionData: {
          execution: {}
        }
      };

      kv.get.mockResolvedValue(sessionData);

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          sessionId: 'session-123'
        }
      });

      await checkpointMonitorHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      expect(response.sessionCheckpoints).toEqual([]);
      expect(response.metrics.totalCreated).toBe(0);
      expect(response.metrics.totalExecuted).toBe(0);
      expect(response.metrics.executionRate).toBe(0);
    });

    test('should return global status when no session specified', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default;

      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getStatus: jest.fn().mockResolvedValue({
          timestamp: '2022-01-01T00:00:00.000Z',
          checkpoints: { total: 25 },
          transactions: { total: 12, active: 3 },
          locks: { active: 2 }
        })
      };

      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints);

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {}
      });

      await checkpointMonitorHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      expect(response.sessionId).toBeNull();
      expect(response.sessionCheckpoints).toBeNull();
      expect(response.systemStatus.checkpoints.total).toBe(25);
      expect(response.systemStatus.transactions.active).toBe(3);
      expect(response.systemStatus.locks.active).toBe(2);
    });

    test('should handle monitoring system errors', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default;

      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getStatus: jest.fn().mockRejectedValue(new Error('System monitoring failed'))
      };

      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints);

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {}
      });

      await checkpointMonitorHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Failed to get checkpoint status');
      expect(response.details).toBe('System monitoring failed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle KV store connection errors', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');

      verifyAgentAuth.validateToken.mockReturnValue(true);
      kv.get.mockRejectedValue(new Error('KV connection timeout'));

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          type: 'test',
          description: 'Test error'
        }
      });

      await checkpointCreateHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Failed to create checkpoint');
      expect(response.details).toBe('KV connection timeout');
    });

    test('should handle atomic checkpoint initialization failure', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default;

      verifyAgentAuth.validateToken.mockReturnValue(true);
      kv.get.mockResolvedValue({
        sessionData: { execution: { checkpoints: [] } }
      });

      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockRejectedValue(new Error('Failed to initialize atomic system'))
      };

      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints);

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          type: 'test',
          description: 'Test initialization failure'
        }
      });

      await checkpointCreateHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Failed to create checkpoint');
      expect(response.details).toBe('Failed to initialize atomic system');
    });

    test('should validate checkpoint data structure', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default;

      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockResolvedValue(undefined),
        createCheckpoint: jest.fn().mockResolvedValue({
          checkpointId: 'checkpoint-validate',
          filesBackedUp: 0
        })
      };

      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints);

      kv.get.mockResolvedValue({
        sessionData: { execution: { checkpoints: [] } }
      });
      kv.set.mockResolvedValue('OK');

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          type: 'validation_test',
          description: 'Test data validation',
          data: {
            complexObject: {
              nested: { value: 123 },
              array: [1, 2, 3, 'test']
            }
          },
          metadata: {
            customField: 'custom value',
            timestamp: '2022-01-01T00:00:00.000Z'
          }
        }
      });

      await checkpointCreateHandler(req, res);

      expect(res._getStatusCode()).toBe(201);
      const response = JSON.parse(res._getData());

      // Verify complex data structure was handled
      expect(response.metadata.dataSize).toBeGreaterThan(0);

      // Verify checkpoint data was stored correctly
      const checkpointCall = kv.set.mock.calls.find(call =>
        call[0].startsWith('collaboration:checkpoint:')
      );
      const checkpointData = checkpointCall[1];

      expect(checkpointData.data.complexObject.nested.value).toBe(123);
      expect(checkpointData.metadata.customField).toBe('custom value');
    });
  });

  describe('Authentication and Authorization', () => {
    test('should require valid agent authentication for all endpoints', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(false);

      const endpoints = [
        { handler: checkpointCreateHandler, method: 'POST' },
        { handler: checkpointExecuteHandler, method: 'POST' },
        { handler: checkpointMonitorHandler, method: 'GET' }
      ];

      for (const endpoint of endpoints) {
        const { req, res } = createMocks({
          method: endpoint.method,
          headers: {
            'x-agent-auth': 'invalid-token'
          },
          body: {},
          query: {}
        });

        await endpoint.handler(req, res);

        expect(res._getStatusCode()).toBe(401);
        const response = JSON.parse(res._getData());
        expect(response.error).toBe('Invalid agent authentication');
      }
    });

    test('should sanitize authentication tokens in logs', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default;

      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockResolvedValue(undefined),
        createCheckpoint: jest.fn().mockResolvedValue({
          checkpointId: 'checkpoint-sanitize',
          filesBackedUp: 0
        })
      };

      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints);

      kv.get.mockResolvedValue({
        sessionData: { execution: { checkpoints: [] } }
      });
      kv.set.mockResolvedValue('OK');

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'very-long-secret-token-that-should-be-sanitized'
        },
        body: {
          sessionId: 'session-123',
          type: 'sanitize_test',
          description: 'Test token sanitization'
        }
      });

      await checkpointCreateHandler(req, res);

      expect(res._getStatusCode()).toBe(201);

      // Verify token was sanitized in stored data
      const checkpointCall = kv.set.mock.calls.find(call =>
        call[0].startsWith('collaboration:checkpoint:')
      );
      const checkpointData = checkpointCall[1];

      expect(checkpointData.metadata.agentAuth).toBe('very-long-...');
      expect(checkpointData.metadata.agentAuth).not.toContain('secret-token');
    });
  });
});

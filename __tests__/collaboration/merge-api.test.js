/**
 * Unit Tests for Collaboration Merge API
 * Tests conflict detection, resolution, and merge operations
 */

import { createMocks } from 'node-mocks-http';
import mergeConflictsHandler from '../../pages/api/collaboration/merge/conflicts';
import mergeResolveHandler from '../../pages/api/collaboration/merge/resolve';

// Mock dependencies
jest.mock('@vercel/kv');
jest.mock('../../lib/security/agent-auth');

describe('Collaboration Merge API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/collaboration/merge/conflicts (Detect Conflicts)', () => {
    test('should detect line conflicts between content versions', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(true);

      const originalContent = `# CLAUDE.md
## Sacred Principles
- NO SIMULATIONS
- ALWAYS REAL
## Development Rules
- Test everything`;

      const modifiedContent = `# CLAUDE.md
## Sacred Principles
- NO SIMULATIONS
- NO FALLBACKS
- ALWAYS REAL
## Development Rules
- Test everything thoroughly
- Document changes`;

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          originalContent,
          modifiedContent,
          conflictThreshold: 'low'
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      expect(response.sessionId).toBe('session-123');
      expect(response.conflicts).toBeDefined();
      expect(Array.isArray(response.conflicts)).toBe(true);
      expect(response.analysis).toBeDefined();
      expect(response.analysis.totalConflicts).toBeGreaterThan(0);
      expect(response.timestamp).toBeDefined();

      // Should detect line additions
      const additionConflicts = response.conflicts.filter(c => c.changeType === 'addition');
      expect(additionConflicts.length).toBeGreaterThan(0);

      // Should detect line modifications
      const modificationConflicts = response.conflicts.filter(c => c.changeType === 'modification');
      expect(modificationConflicts.length).toBeGreaterThan(0);
    });

    test('should detect sacred section violations', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(true);

      const originalContent = `# CLAUDE.md
## Sacred Principles
- NO SIMULATIONS
- NO FALLBACKS
- ALWAYS REAL`;

      const modifiedContent = `# CLAUDE.md
## Sacred Principles
- USE SIMULATIONS WHEN NEEDED
- FALLBACKS ARE OKAY
- SOMETIMES MOCK`;

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          originalContent,
          modifiedContent,
          detectSacredViolations: true
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      // Should detect critical sacred violations
      const sacredConflicts = response.conflicts.filter(c => c.category === 'sacred');
      expect(sacredConflicts.length).toBeGreaterThan(0);

      const criticalConflicts = response.conflicts.filter(c => c.severity === 'critical');
      expect(criticalConflicts.length).toBeGreaterThan(0);

      // Analysis should flag critical issues
      expect(response.analysis.severityBreakdown.critical).toBeGreaterThan(0);
      expect(response.analysis.categoryBreakdown.sacred).toBeGreaterThan(0);
      expect(response.analysis.recommendations).toContain('Sacred content violations detected: These must be resolved manually');
    });

    test('should detect structural changes in headers', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(true);

      const originalContent = `# Project Title
## Section One
Content here
## Section Two
More content`;

      const modifiedContent = `# Project Title
## Section One
Content here
## Modified Section Two
Different content
## New Section Three
Additional content`;

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          originalContent,
          modifiedContent
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      // Should detect structural changes
      const structuralConflicts = response.conflicts.filter(c => c.category === 'structure');
      expect(structuralConflicts.length).toBeGreaterThan(0);

      // Should detect header modifications and additions
      const headerModifications = structuralConflicts.filter(c => c.changeType === 'modification');
      const headerAdditions = structuralConflicts.filter(c => c.changeType === 'addition');

      expect(headerModifications.length).toBeGreaterThan(0);
      expect(headerAdditions.length).toBeGreaterThan(0);
    });

    test('should filter conflicts by severity threshold', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(true);

      const originalContent = `# Test
Regular line
## Sacred Principles
- NO SIMULATIONS`;

      const modifiedContent = `# Test
Modified regular line
## Sacred Principles
- USE SIMULATIONS`;

      // Test with high threshold
      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': 'valid-token' },
        body: {
          sessionId: 'session-123',
          originalContent,
          modifiedContent,
          conflictThreshold: 'high'
        }
      });

      await mergeConflictsHandler(req1, res1);

      const response1 = JSON.parse(res1._getData());
      const highThresholdConflicts = response1.conflicts;

      // Test with low threshold
      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': 'valid-token' },
        body: {
          sessionId: 'session-123',
          originalContent,
          modifiedContent,
          conflictThreshold: 'low'
        }
      });

      await mergeConflictsHandler(req2, res2);

      const response2 = JSON.parse(res2._getData());
      const lowThresholdConflicts = response2.conflicts;

      // Low threshold should include more conflicts
      expect(lowThresholdConflicts.length).toBeGreaterThanOrEqual(highThresholdConflicts.length);
    });

    test('should reject requests without authentication', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(false);

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'invalid-token'
        },
        body: {
          sessionId: 'session-123',
          originalContent: 'test',
          modifiedContent: 'test2'
        }
      });

      await mergeConflictsHandler(req, res);

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
          // Missing originalContent and modifiedContent
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Missing required fields: sessionId, originalContent, modifiedContent');
    });

    test('should calculate edit distance correctly', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(true);

      // Test with known edit distance cases
      const originalContent = 'kitten';
      const modifiedContent = 'sitting';

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          originalContent,
          modifiedContent,
          conflictThreshold: 'low'
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      // Should detect the line modification
      const modificationConflicts = response.conflicts.filter(c => c.changeType === 'modification');
      expect(modificationConflicts.length).toBe(1);
    });

    test('should provide comprehensive analysis breakdown', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(true);

      const originalContent = `# Test
## Sacred Principles
- NO SIMULATIONS
Normal line
## Structure`;

      const modifiedContent = `# Test
## Sacred Principles
- SIMULATIONS OK
Modified normal line
## Different Structure
New line`;

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          originalContent,
          modifiedContent,
          detectSacredViolations: true
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      expect(response.analysis.totalConflicts).toBeGreaterThan(0);
      expect(response.analysis.severityBreakdown).toHaveProperty('critical');
      expect(response.analysis.severityBreakdown).toHaveProperty('high');
      expect(response.analysis.severityBreakdown).toHaveProperty('medium');
      expect(response.analysis.severityBreakdown).toHaveProperty('low');

      expect(response.analysis.categoryBreakdown).toHaveProperty('content');
      expect(response.analysis.categoryBreakdown).toHaveProperty('structure');
      expect(response.analysis.categoryBreakdown).toHaveProperty('sacred');
      expect(response.analysis.categoryBreakdown).toHaveProperty('meaning');

      expect(Array.isArray(response.analysis.recommendations)).toBe(true);
    });
  });

  describe('GET /api/collaboration/merge/conflicts (Get Conflicts)', () => {
    test('should retrieve conflicts by merge ID', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');

      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockMergeData = {
        id: 'merge-123',
        sessionId: 'session-123',
        status: 'pending',
        conflicts: [
          {
            id: 'conflict-1',
            type: 'line_change',
            severity: 'medium',
            category: 'content'
          },
          {
            id: 'conflict-2',
            type: 'sacred_violation',
            severity: 'critical',
            category: 'sacred'
          }
        ],
        resolvedConflicts: [],
        unresolvedConflicts: ['conflict-1', 'conflict-2']
      };

      kv.get.mockResolvedValue(mockMergeData);

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          mergeId: 'merge-123'
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      expect(response.mergeId).toBe('merge-123');
      expect(response.sessionId).toBe('session-123');
      expect(response.conflicts).toHaveLength(2);
      expect(response.status).toBe('pending');
      expect(response.totalConflicts).toBe(2);
      expect(response.resolvedCount).toBe(0);
      expect(response.unresolvedCount).toBe(2);

      // Should enrich conflicts with suggestions
      expect(response.conflicts[0].suggestions).toBeDefined();
      expect(response.conflicts[1].suggestions).toBeDefined();
    });

    test('should retrieve conflicts by session ID', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');

      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockSessionData = {
        sessionData: {
          merge: {
            currentMerge: {
              id: 'merge-456',
              sessionId: 'session-456',
              status: 'in_progress',
              conflicts: [
                {
                  id: 'conflict-3',
                  type: 'structural_change',
                  severity: 'high',
                  category: 'structure'
                }
              ]
            }
          }
        }
      };

      kv.get.mockResolvedValue(mockSessionData);

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          sessionId: 'session-456'
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      expect(response.mergeId).toBe('merge-456');
      expect(response.sessionId).toBe('session-456');
      expect(response.conflicts).toHaveLength(1);
      expect(response.status).toBe('in_progress');
    });

    test('should return 404 for non-existent merge', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');

      verifyAgentAuth.validateToken.mockReturnValue(true);
      kv.get.mockResolvedValue(null);

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          mergeId: 'nonexistent-merge'
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(404);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Merge data not found');
    });

    test('should require either mergeId or sessionId', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(true);

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {}
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Either mergeId or sessionId must be provided');
    });

    test('should enrich conflicts with resolution suggestions', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');

      verifyAgentAuth.validateToken.mockReturnValue(true);

      const mockMergeData = {
        id: 'merge-suggestions',
        sessionId: 'session-123',
        conflicts: [
          {
            id: 'critical-conflict',
            severity: 'critical',
            type: 'sacred_violation'
          },
          {
            id: 'high-conflict',
            severity: 'high',
            type: 'structural_change'
          },
          {
            id: 'medium-conflict',
            severity: 'medium',
            type: 'line_change'
          },
          {
            id: 'low-conflict',
            severity: 'low',
            type: 'line_change'
          }
        ]
      };

      kv.get.mockResolvedValue(mockMergeData);

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          mergeId: 'merge-suggestions'
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      // Critical conflict should have manual review suggestion
      const criticalConflict = response.conflicts.find(c => c.id === 'critical-conflict');
      expect(criticalConflict.suggestions).toContainEqual(
        expect.objectContaining({
          action: 'manual_review',
          recommended: true
        })
      );

      // High conflict should suggest keeping original
      const highConflict = response.conflicts.find(c => c.id === 'high-conflict');
      expect(highConflict.suggestions).toContainEqual(
        expect.objectContaining({
          action: 'accept_original',
          recommended: true
        })
      );

      // Medium conflict should suggest manual review
      const mediumConflict = response.conflicts.find(c => c.id === 'medium-conflict');
      expect(mediumConflict.suggestions).toContainEqual(
        expect.objectContaining({
          action: 'manual_review',
          recommended: true
        })
      );

      // Low conflict should suggest accepting modified
      const lowConflict = response.conflicts.find(c => c.id === 'low-conflict');
      expect(lowConflict.suggestions).toContainEqual(
        expect.objectContaining({
          action: 'accept_modified',
          recommended: true
        })
      );
    });
  });

  describe('Method Validation', () => {
    test('should reject non-supported HTTP methods', async () => {
      const { req, res } = createMocks({
        method: 'PUT'
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(405);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Method not allowed');
    });
  });

  describe('Error Handling', () => {
    test('should handle conflict detection errors gracefully', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(true);

      // Create content that will cause an error in processing
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          originalContent: null, // This should cause an error
          modifiedContent: 'test'
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Failed to detect conflicts');
      expect(response.details).toBeDefined();
    });

    test('should handle KV store errors', async () => {
      const { kv } = require('@vercel/kv');
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');

      verifyAgentAuth.validateToken.mockReturnValue(true);
      kv.get.mockRejectedValue(new Error('KV store connection failed'));

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          mergeId: 'merge-123'
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const response = JSON.parse(res._getData());
      expect(response.error).toBe('Failed to get conflicts');
      expect(response.details).toBe('KV store connection failed');
    });
  });

  describe('Conflict Analysis Functions', () => {
    test('should identify sacred line patterns correctly', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(true);

      const originalContent = `Normal line
## 1. Sacred Principles
**ABSOLUTE RULES - NEVER VIOLATE**
**NO SIMULATIONS**
deployment target: production
team account: bhuman`;

      const modifiedContent = `Modified normal line
## 1. Sacred Principles
**ABSOLUTE RULES - MAYBE VIOLATE**
**SIMULATIONS OK**
deployment target: staging
team account: different`;

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          originalContent,
          modifiedContent,
          detectSacredViolations: true
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      // Should detect multiple critical conflicts for sacred content
      const criticalConflicts = response.conflicts.filter(c => c.severity === 'critical');
      expect(criticalConflicts.length).toBeGreaterThan(0);

      // Should detect sacred section violations
      const sacredConflicts = response.conflicts.filter(c => c.category === 'sacred');
      expect(sacredConflicts.length).toBeGreaterThan(0);
    });

    test('should calculate line severity based on content type', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(true);

      const originalContent = `# Header
**Important Section**
## 2. Sacred Principles
Regular text line
deployment target: production`;

      const modifiedContent = `# Modified Header
**Changed Important Section**
## 2. Different Sacred Principles
Completely different regular text
deployment target: staging`;

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          originalContent,
          modifiedContent
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      // Should have different severity levels
      const severities = [...new Set(response.conflicts.map(c => c.severity))];
      expect(severities.length).toBeGreaterThan(1);

      // Should have critical severity for sacred content
      expect(severities).toContain('critical');
    });

    test('should extract and compare headers correctly', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(true);

      const originalContent = `# Main Title
## Section A
### Subsection 1
## Section B`;

      const modifiedContent = `# Main Title
## Modified Section A
### Different Subsection 1
## Section B
### New Subsection 2`;

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          originalContent,
          modifiedContent
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      // Should detect structural changes
      const structuralConflicts = response.conflicts.filter(c => c.category === 'structure');
      expect(structuralConflicts.length).toBeGreaterThan(0);

      // Should detect both modifications and additions
      const modifications = structuralConflicts.filter(c => c.changeType === 'modification');
      const additions = structuralConflicts.filter(c => c.changeType === 'addition');

      expect(modifications.length).toBeGreaterThan(0);
      expect(additions.length).toBeGreaterThan(0);
    });

    test('should handle semantic conflict detection', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth');
      verifyAgentAuth.validateToken.mockReturnValue(true);

      const originalContent = 'This is a comprehensive system. It handles all cases perfectly. The implementation is complete.';
      const modifiedContent = 'This is a basic system. It might handle some cases. The implementation needs work.';

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          originalContent,
          modifiedContent,
          conflictThreshold: 'low'
        }
      });

      await mergeConflictsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());

      // Should detect semantic changes
      const semanticConflicts = response.conflicts.filter(c => c.category === 'meaning');
      expect(semanticConflicts.length).toBeGreaterThan(0);

      // Should have confidence scores
      semanticConflicts.forEach(conflict => {
        expect(conflict.confidence).toBeDefined();
        expect(typeof conflict.confidence).toBe('number');
      });
    });
  });
});

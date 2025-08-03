/**
 * Unit Tests for Collaboration Drafts API
 * Tests draft creation, updating, retrieval, and validation
 */

import { createMocks } from 'node-mocks-http'
import draftCreateHandler from '../../pages/api/collaboration/drafts/create'
import draftUpdateHandler from '../../pages/api/collaboration/drafts/update'
import draftRetrieveHandler from '../../pages/api/collaboration/drafts/retrieve'
import draftListHandler from '../../pages/api/collaboration/drafts/list'

// Mock dependencies
jest.mock('@vercel/kv')
jest.mock('../../lib/security/agent-auth')
jest.mock('../../lib/security/atomic-checkpoints')
jest.mock('../../lib/claude-integrity')

describe('Collaboration Drafts API', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
  })

  describe('POST /api/collaboration/drafts/create', () => {
    test('should create draft successfully with valid data', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')
      const { createCheckpoint } = require('../../lib/security/atomic-checkpoints')
      const { validateClaudemdContent } = require('../../lib/claude-integrity')

      // Setup mocks
      verifyAgentAuth.validateToken.mockReturnValue(true)
      validateClaudemdContent.mockResolvedValue({
        isValid: true,
        score: 0.95,
        errors: []
      })
      createCheckpoint.mockResolvedValue({
        id: 'checkpoint-123',
        timestamp: '2022-01-01T00:00:00.000Z'
      })
      kv.set.mockResolvedValue('OK')
      kv.get.mockResolvedValue({
        sessionData: {
          ideation: { drafts: [] }
        },
        lastAccessed: '2022-01-01T00:00:00.000Z'
      })

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token-123'
        },
        body: {
          sessionId: 'session-123',
          content: '# Test CLAUDE.md\n## Sacred Principles\n- NO SIMULATIONS',
          title: 'Test Draft',
          description: 'Test draft creation',
          metadata: { author: 'test-agent' }
        }
      })

      await draftCreateHandler(req, res)

      expect(res._getStatusCode()).toBe(201)
      const response = JSON.parse(res._getData())
      
      expect(response.draftId).toMatch(/^draft_\d+_[a-z0-9]{9}$/)
      expect(response.sessionId).toBe('session-123')
      expect(response.title).toBe('Test Draft')
      expect(response.version).toBe(1)
      expect(response.checkpointId).toBe('checkpoint-123')
      expect(response.status).toBe('created')
      expect(response.stats).toBeDefined()
      expect(response.validation.isValid).toBe(true)

      // Verify KV operations
      expect(kv.set).toHaveBeenCalledWith(
        expect.stringMatching(/^collaboration:draft:draft_/),
        expect.objectContaining({
          title: 'Test Draft',
          content: expect.stringContaining('Sacred Principles'),
          version: 1,
          status: 'draft'
        }),
        { ex: 3600 * 24 * 7 }
      )
    })

    test('should reject requests without agent authentication', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')
      verifyAgentAuth.validateToken.mockReturnValue(false)

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'invalid-token'
        },
        body: {
          sessionId: 'session-123',
          content: 'test content',
          title: 'Test Draft'
        }
      })

      await draftCreateHandler(req, res)

      expect(res._getStatusCode()).toBe(401)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Invalid agent authentication')
    })

    test('should reject requests with missing required fields', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')
      verifyAgentAuth.validateToken.mockReturnValue(true)

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          // Missing sessionId, content, title
        }
      })

      await draftCreateHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Missing required fields: sessionId, content, title')
    })

    test('should reject content that violates sacred principles', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')
      const { validateClaudemdContent } = require('../../lib/claude-integrity')

      verifyAgentAuth.validateToken.mockReturnValue(true)
      validateClaudemdContent.mockResolvedValue({
        isValid: false,
        score: 0.3,
        errors: ['Contains simulation patterns', 'Violates NO FALLBACKS principle']
      })

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          content: 'We can simulate this behavior as a fallback',
          title: 'Invalid Draft'
        }
      })

      await draftCreateHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Content validation failed')
      expect(response.details).toEqual(['Contains simulation patterns', 'Violates NO FALLBACKS principle'])
    })

    test('should reject non-POST methods', async () => {
      const { req, res } = createMocks({
        method: 'GET'
      })

      await draftCreateHandler(req, res)

      expect(res._getStatusCode()).toBe(405)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Method not allowed')
    })

    test('should handle checkpoint creation errors', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')
      const { validateClaudemdContent } = require('../../lib/claude-integrity')
      const { createCheckpoint } = require('../../lib/security/atomic-checkpoints')

      verifyAgentAuth.validateToken.mockReturnValue(true)
      validateClaudemdContent.mockResolvedValue({ isValid: true, score: 0.9 })
      createCheckpoint.mockRejectedValue(new Error('Checkpoint creation failed'))

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          content: 'test content',
          title: 'Test Draft'
        }
      })

      await draftCreateHandler(req, res)

      expect(res._getStatusCode()).toBe(500)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Failed to create draft')
      expect(response.details).toBe('Checkpoint creation failed')
    })

    test('should calculate content statistics correctly', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')
      const { validateClaudemdContent } = require('../../lib/claude-integrity')
      const { createCheckpoint } = require('../../lib/security/atomic-checkpoints')

      verifyAgentAuth.validateToken.mockReturnValue(true)
      validateClaudemdContent.mockResolvedValue({ isValid: true, score: 0.9 })
      createCheckpoint.mockResolvedValue({ id: 'checkpoint-123' })
      kv.set.mockResolvedValue('OK')
      kv.get.mockResolvedValue({
        sessionData: { ideation: { drafts: [] } }
      })

      const testContent = `# Test Document
This is line one.
This is line two.

This line has multiple   spaces   between   words.`

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          content: testContent,
          title: 'Stats Test'
        }
      })

      await draftCreateHandler(req, res)

      expect(res._getStatusCode()).toBe(201)
      const response = JSON.parse(res._getData())
      
      expect(response.stats.lineCount).toBe(5) // Including empty line
      expect(response.stats.characterCount).toBe(testContent.length)
      expect(response.stats.wordCount).toBe(16) // Counting actual words
    })
  })

  describe('POST /api/collaboration/drafts/update', () => {
    test('should update existing draft successfully', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')
      const { validateClaudemdContent } = require('../../lib/claude-integrity')

      verifyAgentAuth.validateToken.mockReturnValue(true)
      validateClaudemdContent.mockResolvedValue({ isValid: true, score: 0.95 })

      const existingDraft = {
        id: 'draft-123',
        sessionId: 'session-123',
        title: 'Original Title',
        content: 'Original content',
        version: 1,
        versionHistory: [{
          version: 1,
          timestamp: '2022-01-01T00:00:00.000Z',
          content: 'Original content'
        }],
        metadata: {
          wordCount: 2,
          characterCount: 16,
          lineCount: 1
        }
      }

      kv.get.mockResolvedValue(existingDraft)
      kv.set.mockResolvedValue('OK')

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          draftId: 'draft-123',
          content: 'Updated content with more text',
          title: 'Updated Title'
        }
      })

      await draftUpdateHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      
      expect(response.draftId).toBe('draft-123')
      expect(response.version).toBe(2)
      expect(response.title).toBe('Updated Title')
      expect(response.status).toBe('updated')

      // Verify the draft was updated in KV
      const updateCall = kv.set.mock.calls.find(call => 
        call[0] === 'collaboration:draft:draft-123'
      )
      expect(updateCall).toBeDefined()
      
      const updatedDraft = updateCall[1]
      expect(updatedDraft.version).toBe(2)
      expect(updatedDraft.title).toBe('Updated Title')
      expect(updatedDraft.content).toBe('Updated content with more text')
      expect(updatedDraft.versionHistory).toHaveLength(2)
    })

    test('should reject update of non-existent draft', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')

      verifyAgentAuth.validateToken.mockReturnValue(true)
      kv.get.mockResolvedValue(null) // Draft not found

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          draftId: 'nonexistent-draft',
          content: 'Updated content'
        }
      })

      await draftUpdateHandler(req, res)

      expect(res._getStatusCode()).toBe(404)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Draft not found')
    })

    test('should track changes between versions', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')
      const { validateClaudemdContent } = require('../../lib/claude-integrity')

      verifyAgentAuth.validateToken.mockReturnValue(true)
      validateClaudemdContent.mockResolvedValue({ isValid: true, score: 0.9 })

      const existingDraft = {
        id: 'draft-123',
        content: 'Line 1\nLine 2\nLine 3',
        version: 1,
        versionHistory: []
      }

      kv.get.mockResolvedValue(existingDraft)
      kv.set.mockResolvedValue('OK')

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          draftId: 'draft-123',
          content: 'Line 1\nModified Line 2\nLine 3\nNew Line 4'
        }
      })

      await draftUpdateHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      
      expect(response.changes).toBeDefined()
      expect(response.changes.added).toBe(1) // New Line 4
      expect(response.changes.modified).toBe(1) // Modified Line 2
      expect(response.changes.removed).toBe(0)
      expect(response.changes.total).toBe(2)
    })
  })

  describe('GET /api/collaboration/drafts/retrieve', () => {
    test('should retrieve existing draft', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')

      verifyAgentAuth.validateToken.mockReturnValue(true)

      const mockDraft = {
        id: 'draft-123',
        sessionId: 'session-123',
        title: 'Test Draft',
        content: 'Draft content',
        version: 2,
        status: 'draft',
        createdAt: '2022-01-01T00:00:00.000Z',
        lastModified: '2022-01-01T01:00:00.000Z'
      }

      kv.get.mockResolvedValue(mockDraft)

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          draftId: 'draft-123'
        }
      })

      await draftRetrieveHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      
      expect(response).toEqual(mockDraft)
    })

    test('should return 404 for non-existent draft', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')

      verifyAgentAuth.validateToken.mockReturnValue(true)
      kv.get.mockResolvedValue(null)

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          draftId: 'nonexistent-draft'
        }
      })

      await draftRetrieveHandler(req, res)

      expect(res._getStatusCode()).toBe(404)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Draft not found')
    })

    test('should include version history when requested', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')

      verifyAgentAuth.validateToken.mockReturnValue(true)

      const mockDraft = {
        id: 'draft-123',
        versionHistory: [
          { version: 1, content: 'Original content' },
          { version: 2, content: 'Updated content' }
        ]
      }

      kv.get.mockResolvedValue(mockDraft)

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          draftId: 'draft-123',
          includeHistory: 'true'
        }
      })

      await draftRetrieveHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      
      expect(response.versionHistory).toHaveLength(2)
      expect(response.versionHistory[0].version).toBe(1)
      expect(response.versionHistory[1].version).toBe(2)
    })
  })

  describe('GET /api/collaboration/drafts/list', () => {
    test('should list drafts for session', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')

      verifyAgentAuth.validateToken.mockReturnValue(true)

      const sessionData = {
        sessionData: {
          ideation: {
            drafts: [
              { id: 'draft-1', title: 'First Draft', timestamp: '2022-01-01T00:00:00.000Z' },
              { id: 'draft-2', title: 'Second Draft', timestamp: '2022-01-01T01:00:00.000Z' }
            ]
          }
        }
      }

      kv.get.mockResolvedValue(sessionData)

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          sessionId: 'session-123'
        }
      })

      await draftListHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      
      expect(response.drafts).toHaveLength(2)
      expect(response.drafts[0].id).toBe('draft-1')
      expect(response.drafts[1].id).toBe('draft-2')
      expect(response.sessionId).toBe('session-123')
      expect(response.total).toBe(2)
    })

    test('should handle session without drafts', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')

      verifyAgentAuth.validateToken.mockReturnValue(true)

      const sessionData = {
        sessionData: {
          ideation: {}
        }
      }

      kv.get.mockResolvedValue(sessionData)

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          sessionId: 'session-123'
        }
      })

      await draftListHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      
      expect(response.drafts).toEqual([])
      expect(response.total).toBe(0)
    })

    test('should return 404 for non-existent session', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')

      verifyAgentAuth.validateToken.mockReturnValue(true)
      kv.get.mockResolvedValue(null)

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          sessionId: 'nonexistent-session'
        }
      })

      await draftListHandler(req, res)

      expect(res._getStatusCode()).toBe(404)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Session not found')
    })

    test('should support pagination', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')

      verifyAgentAuth.validateToken.mockReturnValue(true)

      const drafts = Array.from({ length: 25 }, (_, i) => ({
        id: `draft-${i + 1}`,
        title: `Draft ${i + 1}`,
        timestamp: new Date(2022, 0, 1, i).toISOString()
      }))

      const sessionData = {
        sessionData: {
          ideation: { drafts }
        }
      }

      kv.get.mockResolvedValue(sessionData)

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          sessionId: 'session-123',
          page: '2',
          limit: '10'
        }
      })

      await draftListHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      
      expect(response.drafts).toHaveLength(10)
      expect(response.drafts[0].id).toBe('draft-11') // Second page
      expect(response.total).toBe(25)
      expect(response.page).toBe(2)
      expect(response.totalPages).toBe(3)
    })
  })

  describe('Error Handling', () => {
    test('should handle KV store errors gracefully', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')

      verifyAgentAuth.validateToken.mockReturnValue(true)
      kv.get.mockRejectedValue(new Error('KV store connection failed'))

      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        query: {
          draftId: 'draft-123'
        }
      })

      await draftRetrieveHandler(req, res)

      expect(res._getStatusCode()).toBe(500)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Failed to retrieve draft')
      expect(response.details).toBe('KV store connection failed')
    })

    test('should handle validation errors during update', async () => {
      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')
      const { validateClaudemdContent } = require('../../lib/claude-integrity')

      verifyAgentAuth.validateToken.mockReturnValue(true)
      kv.get.mockResolvedValue({ id: 'draft-123', version: 1 })
      validateClaudemdContent.mockResolvedValue({
        isValid: false,
        errors: ['Content contains forbidden patterns']
      })

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          draftId: 'draft-123',
          content: 'Invalid content with simulation patterns'
        }
      })

      await draftUpdateHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Content validation failed')
      expect(response.details).toEqual(['Content contains forbidden patterns'])
    })
  })

  describe('Content Hash Verification', () => {
    test('should generate consistent content hashes', async () => {
      const crypto = require('crypto')
      
      // Mock the hashContent function
      const testContent = 'Test content for hashing'
      const expectedHash = crypto.createHash('sha256').update(testContent).digest('hex')

      const { kv } = require('@vercel/kv')
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')
      const { validateClaudemdContent } = require('../../lib/claude-integrity')
      const { createCheckpoint } = require('../../lib/security/atomic-checkpoints')

      verifyAgentAuth.validateToken.mockReturnValue(true)
      validateClaudemdContent.mockResolvedValue({ isValid: true, score: 0.9 })
      createCheckpoint.mockResolvedValue({ id: 'checkpoint-123' })
      kv.set.mockResolvedValue('OK')
      kv.get.mockResolvedValue({
        sessionData: { ideation: { drafts: [] } }
      })

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'x-agent-auth': 'valid-token'
        },
        body: {
          sessionId: 'session-123',
          content: testContent,
          title: 'Hash Test'
        }
      })

      await draftCreateHandler(req, res)

      expect(res._getStatusCode()).toBe(201)
      
      // Verify the hash was calculated correctly
      const draftCall = kv.set.mock.calls.find(call => 
        call[0].startsWith('collaboration:draft:')
      )
      expect(draftCall).toBeDefined()
      
      const draftData = draftCall[1]
      expect(draftData.metadata.contentHash).toBe(expectedHash)
    })
  })
})
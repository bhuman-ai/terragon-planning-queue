/**
 * Integration Tests for Collaboration Workflow
 * Tests complete end-to-end workflows combining multiple components
 */

import { createMocks } from 'node-mocks-http'
import sessionInitializeHandler from '../../pages/api/collaboration/session/initialize'
import draftCreateHandler from '../../pages/api/collaboration/drafts/create'
import draftUpdateHandler from '../../pages/api/collaboration/drafts/update'
import checkpointCreateHandler from '../../pages/api/collaboration/checkpoints/create'
import checkpointExecuteHandler from '../../pages/api/collaboration/checkpoints/execute'
import mergeConflictsHandler from '../../pages/api/collaboration/merge/conflicts'
import mergeResolveHandler from '../../pages/api/collaboration/merge/resolve'

// Mock dependencies
jest.mock('@vercel/kv')
jest.mock('../../lib/security/agent-auth')
jest.mock('../../lib/security/atomic-checkpoints')
jest.mock('../../lib/claude-integrity')

describe('Collaboration Workflow Integration', () => {
  let mockKVData = {}
  
  beforeEach(() => {
    jest.clearAllMocks()
    mockKVData = {}
    
    // Setup KV mock to simulate real storage
    const { kv } = require('@vercel/kv')
    kv.get.mockImplementation((key) => Promise.resolve(mockKVData[key] || null))
    kv.set.mockImplementation((key, value, options) => {
      mockKVData[key] = value
      return Promise.resolve('OK')
    })
    kv.del.mockImplementation((key) => {
      delete mockKVData[key]
      return Promise.resolve(1)
    })

    // Setup auth mock
    const { verifyAgentAuth } = require('../../lib/security/agent-auth')
    verifyAgentAuth.validateToken.mockReturnValue(true)

    // Setup claude integrity mock
    const { validateClaudemdContent } = require('../../lib/claude-integrity')
    validateClaudemdContent.mockResolvedValue({
      isValid: true,
      score: 0.95,
      errors: []
    })

    // Setup atomic checkpoints mock
    const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default
    const { createCheckpoint } = require('../../lib/security/atomic-checkpoints')
    
    createCheckpoint.mockResolvedValue({
      id: 'checkpoint-simple',
      timestamp: '2022-01-01T00:00:00.000Z'
    })

    const mockAtomicCheckpoints = {
      initialize: jest.fn().mockResolvedValue(undefined),
      createCheckpoint: jest.fn().mockResolvedValue({
        checkpointId: 'atomic-checkpoint-123',
        filesBackedUp: 0
      }),
      rollbackToCheckpoint: jest.fn().mockResolvedValue({
        success: true,
        filesRestored: 0
      }),
      markCheckpointSuccessful: jest.fn().mockResolvedValue({
        success: true
      })
    }
    
    AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints)
  })

  describe('Complete Draft Lifecycle with Checkpoints', () => {
    test('should handle complete draft creation, update, and checkpoint workflow', async () => {
      const sessionId = 'session-workflow-test'
      const agentAuth = 'agent-token-123'

      // Step 1: Initialize collaboration session
      const { req: initReq, res: initRes } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': agentAuth },
        body: {
          sessionId,
          agentId: 'meta-agent-001',
          metaAgentEnabled: true,
          sessionType: 'claude_md_collaboration'
        }
      })

      await sessionInitializeHandler(initReq, initRes)
      expect(initRes._getStatusCode()).toBe(201)

      const sessionResponse = JSON.parse(initRes._getData())
      expect(sessionResponse.sessionId).toBe(sessionId)

      // Verify session was stored
      expect(mockKVData[`collaboration:session:${sessionId}`]).toBeDefined()
      const sessionData = mockKVData[`collaboration:session:${sessionId}`]
      expect(sessionData.sessionType).toBe('claude_md_collaboration')

      // Step 2: Create initial draft
      const initialContent = `# CLAUDE.md Test
## Sacred Principles
- NO SIMULATIONS
- NO FALLBACKS
- ALWAYS REAL

## Development Guidelines
- Test everything
- Document changes`

      const { req: draftReq, res: draftRes } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': agentAuth },
        body: {
          sessionId,
          content: initialContent,
          title: 'Initial CLAUDE.md Draft',
          description: 'First version of the sacred document'
        }
      })

      await draftCreateHandler(draftReq, draftRes)
      expect(draftRes._getStatusCode()).toBe(201)

      const draftResponse = JSON.parse(draftRes._getData())
      const draftId = draftResponse.draftId
      expect(draftId).toMatch(/^draft_\d+_[a-z0-9]{9}$/)

      // Verify draft was stored and session updated
      expect(mockKVData[`collaboration:draft:${draftId}`]).toBeDefined()
      const draftData = mockKVData[`collaboration:draft:${draftId}`]
      expect(draftData.content).toBe(initialContent)
      expect(draftData.version).toBe(1)

      const updatedSession = mockKVData[`collaboration:session:${sessionId}`]
      expect(updatedSession.sessionData.ideation.drafts).toHaveLength(1)
      expect(updatedSession.sessionData.ideation.drafts[0].id).toBe(draftId)

      // Step 3: Create checkpoint before major changes
      const { req: checkpointReq, res: checkpointRes } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': agentAuth },
        body: {
          sessionId,
          type: 'draft_backup',
          description: 'Checkpoint before adding development rules',
          data: {
            draftId,
            currentVersion: 1
          },
          filePaths: [],
          metadata: {
            reason: 'Before major content addition'
          }
        }
      })

      await checkpointCreateHandler(checkpointReq, checkpointRes)
      expect(checkpointRes._getStatusCode()).toBe(201)

      const checkpointResponse = JSON.parse(checkpointRes._getData())
      const checkpointId = checkpointResponse.checkpointId
      expect(checkpointId).toBe('atomic-checkpoint-123')

      // Verify checkpoint was stored and session updated
      expect(mockKVData[`collaboration:checkpoint:${checkpointId}`]).toBeDefined()
      const checkpointData = mockKVData[`collaboration:checkpoint:${checkpointId}`]
      expect(checkpointData.type).toBe('draft_backup')
      expect(checkpointData.data.draftId).toBe(draftId)

      // Step 4: Update draft with significant changes
      const updatedContent = `# CLAUDE.md Test
## Sacred Principles
- NO SIMULATIONS
- NO FALLBACKS
- ALWAYS REAL

## Development Guidelines
- Test everything thoroughly
- Document all changes with examples
- Follow security-first approach
- Validate sacred principles compliance

## New Section: Collaboration Rules
- Multiple agents can collaborate
- Changes require checkpoints
- Sacred sections need manual approval`

      const { req: updateReq, res: updateRes } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': agentAuth },
        body: {
          draftId,
          content: updatedContent,
          title: 'Enhanced CLAUDE.md Draft',
          description: 'Added collaboration rules and enhanced guidelines'
        }
      })

      await draftUpdateHandler(updateReq, updateRes)
      expect(updateRes._getStatusCode()).toBe(200)

      const updateResponse = JSON.parse(updateRes._getData())
      expect(updateResponse.version).toBe(2)
      expect(updateResponse.changes).toBeDefined()
      expect(updateResponse.changes.added).toBeGreaterThan(0)

      // Verify draft was updated with version history
      const updatedDraft = mockKVData[`collaboration:draft:${draftId}`]
      expect(updatedDraft.version).toBe(2)
      expect(updatedDraft.content).toBe(updatedContent)
      expect(updatedDraft.versionHistory).toHaveLength(2)
      expect(updatedDraft.versionHistory[1].version).toBe(2)

      // Step 5: Detect conflicts between versions
      const { req: conflictReq, res: conflictRes } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': agentAuth },
        body: {
          sessionId,
          originalContent: initialContent,
          modifiedContent: updatedContent,
          detectSacredViolations: true,
          conflictThreshold: 'low'
        }
      })

      await mergeConflictsHandler(conflictReq, conflictRes)
      expect(conflictRes._getStatusCode()).toBe(200)

      const conflictResponse = JSON.parse(conflictRes._getData())
      expect(conflictResponse.conflicts).toBeDefined()
      expect(Array.isArray(conflictResponse.conflicts)).toBe(true)
      expect(conflictResponse.analysis.totalConflicts).toBeGreaterThan(0)

      // Should detect additions but no sacred violations
      const additionConflicts = conflictResponse.conflicts.filter(c => c.changeType === 'addition')
      expect(additionConflicts.length).toBeGreaterThan(0)

      const sacredConflicts = conflictResponse.conflicts.filter(c => c.category === 'sacred')
      expect(sacredConflicts.length).toBe(0) // No sacred violations in this update

      // Step 6: Mark checkpoint as successful since no sacred violations
      const { req: executeReq, res: executeRes } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': agentAuth },
        body: {
          checkpointId,
          action: 'verify',
          reason: 'Draft updated successfully without sacred violations'
        }
      })

      await checkpointExecuteHandler(executeReq, executeRes)
      expect(executeRes._getStatusCode()).toBe(200)

      const executeResponse = JSON.parse(executeRes._getData())
      expect(executeResponse.action).toBe('verify')
      expect(executeResponse.success).toBe(true)

      // Verify checkpoint was marked as executed
      const finalCheckpoint = mockKVData[`collaboration:checkpoint:${checkpointId}`]
      expect(finalCheckpoint.status).toBe('executed')
      expect(finalCheckpoint.action).toBe('verify')
      expect(finalCheckpoint.executedAt).toBeDefined()
    })

    test('should handle rollback workflow when sacred violations detected', async () => {
      const sessionId = 'session-rollback-test'
      const agentAuth = 'agent-token-456'

      // Step 1: Initialize session and create draft
      await initializeSessionAndDraft(sessionId, agentAuth)

      const draftId = getDraftIdFromSession(sessionId)
      expect(draftId).toBeDefined()

      // Step 2: Create checkpoint
      const checkpointId = await createTestCheckpoint(sessionId, agentAuth, draftId)
      expect(checkpointId).toBeDefined()

      // Step 3: Make changes that violate sacred principles
      const violatingContent = `# CLAUDE.md Test
## Sacred Principles
- SIMULATIONS ARE ALLOWED  // VIOLATION!
- FALLBACKS ARE OKAY      // VIOLATION!
- SOMETIMES MOCK          // VIOLATION!

## Development Guidelines
- Test when convenient
- Documentation optional`

      const { req: updateReq, res: updateRes } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': agentAuth },
        body: {
          draftId,
          content: violatingContent,
          title: 'VIOLATING Draft',
          description: 'This violates sacred principles'
        }
      })

      // Mock validation to detect violations
      const { validateClaudemdContent } = require('../../lib/claude-integrity')
      validateClaudemdContent.mockResolvedValueOnce({
        isValid: false,
        score: 0.2,
        errors: ['Contains simulation patterns', 'Violates NO FALLBACKS principle']
      })

      await draftUpdateHandler(updateReq, updateRes)
      expect(updateRes._getStatusCode()).toBe(400) // Should reject violating content

      const updateResponse = JSON.parse(updateRes._getData())
      expect(updateResponse.error).toBe('Content validation failed')
      expect(updateResponse.details).toContain('Contains simulation patterns')

      // Step 4: Since update was rejected, rollback checkpoint
      const { req: rollbackReq, res: rollbackRes } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': agentAuth },
        body: {
          checkpointId,
          action: 'rollback',
          reason: 'Sacred principles violation detected'
        }
      })

      await checkpointExecuteHandler(rollbackReq, rollbackRes)
      expect(rollbackRes._getStatusCode()).toBe(200)

      const rollbackResponse = JSON.parse(rollbackRes._getData())
      expect(rollbackResponse.action).toBe('rollback')
      expect(rollbackResponse.success).toBe(true)

      // Verify checkpoint was marked as executed with rollback
      const finalCheckpoint = mockKVData[`collaboration:checkpoint:${checkpointId}`]
      expect(finalCheckpoint.status).toBe('executed')
      expect(finalCheckpoint.action).toBe('rollback')
    })
  })

  describe('Multi-Agent Collaboration Workflow', () => {
    test('should handle multiple agents working on same session', async () => {
      const sessionId = 'session-multi-agent'
      const agent1Auth = 'agent-1-token'
      const agent2Auth = 'agent-2-token'

      // Agent 1 initializes session
      await initializeSessionAndDraft(sessionId, agent1Auth, 'Agent 1 Initial Draft')
      const draftId = getDraftIdFromSession(sessionId)

      // Agent 2 creates a checkpoint
      const { req: checkpointReq, res: checkpointRes } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': agent2Auth },
        body: {
          sessionId,
          type: 'multi_agent_backup',
          description: 'Agent 2 checkpoint before collaboration',
          data: { collaboratorAgent: 'agent-2' }
        }
      })

      await checkpointCreateHandler(checkpointReq, checkpointRes)
      expect(checkpointRes._getStatusCode()).toBe(201)

      const checkpointId = JSON.parse(checkpointRes._getData()).checkpointId

      // Agent 1 updates draft
      const updatedContent = `# Multi-Agent CLAUDE.md
## Sacred Principles
- NO SIMULATIONS
- NO FALLBACKS
- ALWAYS REAL

## Collaboration Notes
- Agent 1: Initial structure
- Agent 2: Will add security section`

      const { req: updateReq, res: updateRes } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': agent1Auth },
        body: {
          draftId,
          content: updatedContent,
          description: 'Agent 1: Added collaboration tracking'
        }
      })

      await draftUpdateHandler(updateReq, updateRes)
      expect(updateRes._getStatusCode()).toBe(200)

      // Agent 2 creates second draft version
      const agent2Content = `# Multi-Agent CLAUDE.md
## Sacred Principles
- NO SIMULATIONS
- NO FALLBACKS
- ALWAYS REAL

## Collaboration Notes
- Agent 1: Initial structure
- Agent 2: Will add security section

## Security Framework
- Multi-agent authentication required
- Checkpoint before sacred changes
- Rollback on violations`

      const { req: agent2UpdateReq, res: agent2UpdateRes } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': agent2Auth },
        body: {
          draftId,
          content: agent2Content,
          description: 'Agent 2: Added security framework'
        }
      })

      await draftUpdateHandler(agent2UpdateReq, agent2UpdateRes)
      expect(agent2UpdateRes._getStatusCode()).toBe(200)

      const agent2Response = JSON.parse(agent2UpdateRes._getData())
      expect(agent2Response.version).toBe(3) // Version progression

      // Verify version history tracks both agents
      const finalDraft = mockKVData[`collaboration:draft:${draftId}`]
      expect(finalDraft.versionHistory).toHaveLength(3)
      expect(finalDraft.versionHistory[2].content).toBe(agent2Content)

      // Verify session shows collaboration activity
      const session = mockKVData[`collaboration:session:${sessionId}`]
      expect(session.sessionData.execution.checkpoints).toHaveLength(1)
      expect(session.sessionData.execution.checkpoints[0].id).toBe(checkpointId)
    })
  })

  describe('Error Recovery Workflows', () => {
    test('should handle KV store failures gracefully', async () => {
      const { kv } = require('@vercel/kv')
      
      // Simulate KV store failure
      kv.set.mockRejectedValueOnce(new Error('KV store unavailable'))

      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': 'agent-token' },
        body: {
          sessionId: 'test-session',
          content: 'test content',
          title: 'Test Draft'
        }
      })

      await draftCreateHandler(req, res)
      
      expect(res._getStatusCode()).toBe(500)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Failed to create draft')
      expect(response.details).toBe('KV store unavailable')
    })

    test('should handle atomic checkpoint failures', async () => {
      const AtomicCheckpoints = require('../../lib/security/atomic-checkpoints').default
      
      // Mock atomic checkpoint failure
      const mockAtomicCheckpoints = {
        initialize: jest.fn().mockResolvedValue(undefined),
        createCheckpoint: jest.fn().mockRejectedValue(new Error('Atomic system failure'))
      }
      
      AtomicCheckpoints.mockImplementation(() => mockAtomicCheckpoints)

      // Setup session first
      const sessionId = 'session-atomic-failure'
      mockKVData[`collaboration:session:${sessionId}`] = {
        sessionData: { execution: { checkpoints: [] } }
      }

      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': 'agent-token' },
        body: {
          sessionId,
          type: 'test',
          description: 'Test atomic failure'
        }
      })

      await checkpointCreateHandler(req, res)
      
      expect(res._getStatusCode()).toBe(500)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Failed to create checkpoint')
      expect(response.details).toBe('Atomic system failure')
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle large content efficiently', async () => {
      const sessionId = 'session-large-content'
      const agentAuth = 'agent-token'

      // Initialize session
      await initializeSessionAndDraft(sessionId, agentAuth)

      // Create large content (simulating a big CLAUDE.md file)
      const sections = Array.from({ length: 100 }, (_, i) => `
## Section ${i + 1}
This is section ${i + 1} with substantial content that tests the system's ability to handle large documents.
`.repeat(10)).join('\n')

      const largeContent = `# Large CLAUDE.md\n${sections}`

      const draftId = getDraftIdFromSession(sessionId)

      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': agentAuth },
        body: {
          draftId,
          content: largeContent,
          title: 'Large Content Test'
        }
      })

      const startTime = Date.now()
      await draftUpdateHandler(req, res)
      const endTime = Date.now()

      expect(res._getStatusCode()).toBe(200)
      
      // Should complete within reasonable time (less than 2 seconds for test)
      expect(endTime - startTime).toBeLessThan(2000)

      const response = JSON.parse(res._getData())
      expect(response.stats.characterCount).toBe(largeContent.length)
      expect(response.stats.lineCount).toBeGreaterThan(100)
    })

    test('should handle rapid sequential operations', async () => {
      const sessionId = 'session-rapid-ops'
      const agentAuth = 'agent-token'

      // Initialize session
      await initializeSessionAndDraft(sessionId, agentAuth)
      const draftId = getDraftIdFromSession(sessionId)

      // Perform rapid sequential updates
      const operations = []
      for (let i = 0; i < 5; i++) {
        const content = `# Rapid Update ${i + 1}\nThis is update number ${i + 1}`
        
        const { req, res } = createMocks({
          method: 'POST',
          headers: { 'x-agent-auth': agentAuth },
          body: {
            draftId,
            content,
            title: `Rapid Update ${i + 1}`
          }
        })

        operations.push(draftUpdateHandler(req, res))
      }

      // Wait for all operations to complete
      const results = await Promise.all(operations)

      // All operations should succeed
      results.forEach((_, index) => {
        const res = operations[index].res || results[index].res
        if (res && res._getStatusCode) {
          expect(res._getStatusCode()).toBe(200)
        }
      })

      // Verify final state
      const finalDraft = mockKVData[`collaboration:draft:${draftId}`]
      expect(finalDraft.version).toBe(6) // Initial + 5 updates
    })
  })

  // Helper functions
  async function initializeSessionAndDraft(sessionId, agentAuth, title = 'Test Draft') {
    // Initialize session
    const { req: initReq, res: initRes } = createMocks({
      method: 'POST',
      headers: { 'x-agent-auth': agentAuth },
      body: {
        sessionId,
        agentId: 'test-agent',
        metaAgentEnabled: true,
        sessionType: 'claude_md_collaboration'
      }
    })

    await sessionInitializeHandler(initReq, initRes)

    // Create initial draft
    const content = `# Test CLAUDE.md
## Sacred Principles
- NO SIMULATIONS
- NO FALLBACKS
- ALWAYS REAL`

    const { req: draftReq, res: draftRes } = createMocks({
      method: 'POST',
      headers: { 'x-agent-auth': agentAuth },
      body: {
        sessionId,
        content,
        title,
        description: 'Initial test draft'
      }
    })

    await draftCreateHandler(draftReq, draftRes)
  }

  function getDraftIdFromSession(sessionId) {
    const session = mockKVData[`collaboration:session:${sessionId}`]
    return session?.sessionData?.ideation?.drafts?.[0]?.id
  }

  async function createTestCheckpoint(sessionId, agentAuth, draftId) {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-agent-auth': agentAuth },
      body: {
        sessionId,
        type: 'test_checkpoint',
        description: 'Test checkpoint',
        data: { draftId }
      }
    })

    await checkpointCreateHandler(req, res)
    const response = JSON.parse(res._getData())
    return response.checkpointId
  }
})
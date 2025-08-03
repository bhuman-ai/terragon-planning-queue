/**
 * Sacred Document Integrity Tests
 * Tests the complete sacred document protection system including CLAUDE.md integrity,
 * violation detection, and security enforcement
 */

import { createMocks } from 'node-mocks-http'
import SecuritySystem from '../../lib/security/index'
import claudeIntegrityHandler from '../../pages/api/security/verify-sacred'
import draftCreateHandler from '../../pages/api/collaboration/drafts/create'
import mergeConflictsHandler from '../../pages/api/collaboration/merge/conflicts'

// Mock dependencies
jest.mock('@vercel/kv')
jest.mock('fs/promises')

describe('Sacred Document Integrity System', () => {
  let securitySystem
  let mockFileSystem = {}

  beforeEach(() => {
    jest.clearAllMocks()
    mockFileSystem = {}
    securitySystem = new SecuritySystem('/test/project')

    // Setup file system mocks
    const fs = require('fs/promises')
    fs.readFile.mockImplementation((path) => {
      const content = mockFileSystem[path]
      if (content === undefined) {
        return Promise.reject(new Error(`ENOENT: no such file or directory, open '${path}'`))
      }
      return Promise.resolve(content)
    })

    fs.writeFile.mockImplementation((path, content) => {
      mockFileSystem[path] = content
      return Promise.resolve()
    })

    fs.access.mockImplementation((path) => {
      if (mockFileSystem[path] === undefined) {
        return Promise.reject(new Error(`ENOENT: no such file or directory, access '${path}'`))
      }
      return Promise.resolve()
    })

    fs.stat.mockImplementation((path) => {
      if (mockFileSystem[path] === undefined) {
        return Promise.reject(new Error(`ENOENT: no such file or directory, stat '${path}'`))
      }
      return Promise.resolve({
        size: mockFileSystem[path].length,
        mtime: new Date('2022-01-01T00:00:00.000Z'),
        ctime: new Date('2022-01-01T00:00:00.000Z'),
        mode: 0o644
      })
    })

    fs.mkdir.mockResolvedValue(undefined)
    fs.unlink.mockResolvedValue(undefined)
    fs.readdir.mockResolvedValue([])

    // Setup auth mocks
    const { verifyAgentAuth } = require('../../lib/security/agent-auth')
    verifyAgentAuth.validateToken.mockReturnValue(true)
  })

  describe('CLAUDE.md Sacred Content Protection', () => {
    const validClaudeContent = `# Terragon Planning Queue - Sacred Master Document (CLAUDE.md)

## 1. Project Overview
- **Vision:** Semi-autonomous slow steady conscious development using LLMs
- **Current Phase:** Active development
- **Key Architecture:** Next.js frontend with Meta-Agent orchestration

## 3. Sacred Principles & AI Instructions

### ABSOLUTE RULES - NEVER VIOLATE
1. **NO SIMULATIONS** - Never simulate, mock, or fake any functionality
2. **NO FALLBACKS** - Get to the root of problems, never create workarounds
3. **NO TEMPLATES** - Task decomposition must be 100% AI-driven and dynamic
4. **ALWAYS REAL** - Every interaction, API call, and execution must be genuine

### General Instructions
- Your primary job is to manage context and enforce sacred principles
- Always read CLAUDE.md first before any task
- Quality is #1 priority - nothing else matters

## 🚨 CRITICAL DEPLOYMENT INFORMATION

### Sacred Deployment Target
- **ONLY DEPLOY TO**: https://vercel.com/bhuman/terragon-vercel/
- **Team Account**: bhuman (NEVER use bhumanai hobby account)
- **Environment**: Production deployment with proper API keys`

    const violatingClaudeContent = `# Terragon Planning Queue - Modified Document

## 1. Project Overview
- **Vision:** Quick development with shortcuts and simulations
- **Current Phase:** Rapid prototyping
- **Key Architecture:** Simple frontend with mocked services

## 3. Flexible Principles & AI Instructions

### FLEXIBLE RULES - CAN BE MODIFIED
1. **SIMULATIONS OK** - Use simulations and mocks when convenient
2. **FALLBACKS ENCOURAGED** - Create workarounds to save time
3. **TEMPLATES ALLOWED** - Use templates for faster development
4. **SOMETIMES FAKE** - Mock when real implementation is complex

### General Instructions
- Speed over quality is acceptable
- Skip reading CLAUDE.md for simple tasks
- Good enough is fine

## 🚨 DEPLOYMENT INFORMATION

### Deployment Target
- **CAN DEPLOY TO**: Any available Vercel account
- **Team Account**: bhumanai hobby account is fine
- **Environment**: Development deployment is sufficient`

    test('should detect and reject sacred principle violations', async () => {
      // Initialize security system with valid CLAUDE.md
      mockFileSystem['/test/project/CLAUDE.md'] = validClaudeContent
      
      await securitySystem.initialize()

      // Test sacred document verification
      const verification = await securitySystem.verifySacredDocument('/test/project/CLAUDE.md')
      expect(verification.sacred).toBe(true)

      // Now test violation detection in draft creation
      const { kv } = require('@vercel/kv')
      kv.set.mockResolvedValue('OK')
      kv.get.mockResolvedValue({
        sessionData: { ideation: { drafts: [] } }
      })

      // Mock validation to catch violations
      const { validateClaudemdContent } = require('../../lib/claude-integrity')
      validateClaudemdContent.mockImplementation((content) => {
        // Check for sacred violations
        const violations = []
        if (content.includes('SIMULATIONS OK')) {
          violations.push('Violates NO SIMULATIONS principle')
        }
        if (content.includes('FALLBACKS ENCOURAGED')) {
          violations.push('Violates NO FALLBACKS principle')
        }
        if (content.includes('Speed over quality')) {
          violations.push('Violates quality-first principle')
        }
        if (content.includes('bhumanai hobby account is fine')) {
          violations.push('Violates sacred deployment target')
        }

        return Promise.resolve({
          isValid: violations.length === 0,
          score: violations.length === 0 ? 0.95 : 0.2,
          errors: violations
        })
      })

      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': 'valid-token' },
        body: {
          sessionId: 'session-violation-test',
          content: violatingClaudeContent,
          title: 'Violating CLAUDE.md Draft',
          description: 'This should be rejected'
        }
      })

      await draftCreateHandler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Content validation failed')
      expect(response.details).toContain('Violates NO SIMULATIONS principle')
      expect(response.details).toContain('Violates NO FALLBACKS principle')
      expect(response.details).toContain('Violates sacred deployment target')
    })

    test('should allow valid CLAUDE.md modifications', async () => {
      const validModification = `# Terragon Planning Queue - Sacred Master Document (CLAUDE.md)

## 1. Project Overview
- **Vision:** Semi-autonomous slow steady conscious development using LLMs
- **Current Phase:** Active development - Enhanced security features added
- **Key Architecture:** Next.js frontend with Meta-Agent orchestration

## 3. Sacred Principles & AI Instructions

### ABSOLUTE RULES - NEVER VIOLATE
1. **NO SIMULATIONS** - Never simulate, mock, or fake any functionality
2. **NO FALLBACKS** - Get to the root of problems, never create workarounds
3. **NO TEMPLATES** - Task decomposition must be 100% AI-driven and dynamic
4. **ALWAYS REAL** - Every interaction, API call, and execution must be genuine

### General Instructions
- Your primary job is to manage context and enforce sacred principles
- Always read CLAUDE.md first before any task
- Quality is #1 priority - nothing else matters
- New: Enhanced security monitoring active

## 🚨 CRITICAL DEPLOYMENT INFORMATION

### Sacred Deployment Target
- **ONLY DEPLOY TO**: https://vercel.com/bhuman/terragon-vercel/
- **Team Account**: bhuman (NEVER use bhumanai hobby account)
- **Environment**: Production deployment with proper API keys`

      const { kv } = require('@vercel/kv')
      kv.set.mockResolvedValue('OK')
      kv.get.mockResolvedValue({
        sessionData: { ideation: { drafts: [] } }
      })

      // Mock validation to allow valid modifications
      const { validateClaudemdContent } = require('../../lib/claude-integrity')
      const { createCheckpoint } = require('../../lib/security/atomic-checkpoints')
      
      validateClaudemdContent.mockResolvedValue({
        isValid: true,
        score: 0.95,
        errors: []
      })

      createCheckpoint.mockResolvedValue({
        id: 'checkpoint-valid-mod',
        timestamp: '2022-01-01T00:00:00.000Z'
      })

      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': 'valid-token' },
        body: {
          sessionId: 'session-valid-test',
          content: validModification,
          title: 'Valid CLAUDE.md Enhancement',
          description: 'Added security monitoring note'
        }
      })

      await draftCreateHandler(req, res)

      expect(res._getStatusCode()).toBe(201)
      const response = JSON.parse(res._getData())
      expect(response.draftId).toBeDefined()
      expect(response.validation.isValid).toBe(true)
      expect(response.status).toBe('created')
    })

    test('should detect sacred section modifications in merge conflicts', async () => {
      const originalSacredContent = `## Sacred Principles
### ABSOLUTE RULES - NEVER VIOLATE
1. **NO SIMULATIONS** - Never simulate, mock, or fake any functionality
2. **NO FALLBACKS** - Get to the root of problems, never create workarounds`

      const modifiedSacredContent = `## Sacred Principles
### FLEXIBLE RULES - CAN BE MODIFIED
1. **SIMULATIONS OK** - Use simulations when helpful
2. **FALLBACKS ALLOWED** - Create workarounds when needed`

      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': 'valid-token' },
        body: {
          sessionId: 'session-sacred-conflict',
          originalContent: originalSacredContent,
          modifiedContent: modifiedSacredContent,
          detectSacredViolations: true,
          conflictThreshold: 'low'
        }
      })

      await mergeConflictsHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())

      // Should detect critical sacred violations
      const sacredConflicts = response.conflicts.filter(c => c.category === 'sacred')
      expect(sacredConflicts.length).toBeGreaterThan(0)

      const criticalConflicts = response.conflicts.filter(c => c.severity === 'critical')
      expect(criticalConflicts.length).toBeGreaterThan(0)

      // Analysis should flag sacred violations
      expect(response.analysis.categoryBreakdown.sacred).toBeGreaterThan(0)
      expect(response.analysis.severityBreakdown.critical).toBeGreaterThan(0)
      expect(response.analysis.recommendations).toContain('Sacred content violations detected: These must be resolved manually')
    })

    test('should detect deployment target violations', async () => {
      const originalDeployment = `### Sacred Deployment Target
- **ONLY DEPLOY TO**: https://vercel.com/bhuman/terragon-vercel/
- **Team Account**: bhuman (NEVER use bhumanai hobby account)`

      const violatingDeployment = `### Deployment Target
- **CAN DEPLOY TO**: https://vercel.com/bhumanai/terragon-test/
- **Team Account**: bhumanai hobby account is fine`

      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': 'valid-token' },
        body: {
          sessionId: 'session-deployment-violation',
          originalContent: originalDeployment,
          modifiedContent: violatingDeployment,
          detectSacredViolations: true
        }
      })

      await mergeConflictsHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())

      // Should detect deployment target violations
      const deploymentConflicts = response.conflicts.filter(c => 
        c.type === 'sacred_violation' && c.section === 'Deployment Target'
      )
      expect(deploymentConflicts.length).toBeGreaterThan(0)

      // Should be marked as critical
      const criticalConflicts = response.conflicts.filter(c => c.severity === 'critical')
      expect(criticalConflicts.length).toBeGreaterThan(0)
    })
  })

  describe('Integrity Monitoring and Detection', () => {
    test('should detect file tampering through hash verification', async () => {
      const originalContent = validClaudeContent
      const tamperedContent = originalContent.replace('NO SIMULATIONS', 'SIMULATIONS OK')

      // Setup original file and create hash
      mockFileSystem['/test/project/CLAUDE.md'] = originalContent
      
      await securitySystem.initialize()
      const originalChecksum = await securitySystem.createChecksum('/test/project/CLAUDE.md')
      expect(originalChecksum).toBeDefined()

      // Simulate file tampering
      mockFileSystem['/test/project/CLAUDE.md'] = tamperedContent

      // Verify tampering is detected
      const verification = await securitySystem.verifySacredDocument('/test/project/CLAUDE.md')
      expect(verification.sacred).toBe(false)
      expect(verification.critical).toBe(true)
      expect(verification.message).toContain('🚨 CRITICAL: Sacred document CLAUDE.md has been tampered with!')
    })

    test('should maintain integrity chain for all document changes', async () => {
      mockFileSystem['/test/project/CLAUDE.md'] = validClaudeContent
      
      await securitySystem.initialize()

      // Create initial integrity snapshot
      const snapshot1 = await securitySystem.components.hashIntegrity.createIntegritySnapshot()
      expect(snapshot1.success).toBe(true)

      // Make valid modification
      const updatedContent = validClaudeContent + '\n\n## Additional Section\n- New valid content'
      mockFileSystem['/test/project/CLAUDE.md'] = updatedContent

      // Create new checksum for modified content
      await securitySystem.createChecksum('/test/project/CLAUDE.md')

      // Create second snapshot
      const snapshot2 = await securitySystem.components.hashIntegrity.createIntegritySnapshot()
      expect(snapshot2.success).toBe(true)

      // Verify chain integrity
      const chainVerification = await securitySystem.components.hashIntegrity.verifyIntegrityChain()
      expect(chainVerification.valid).toBe(true)
      expect(chainVerification.violations).toHaveLength(0)
    })

    test('should provide comprehensive integrity reports', async () => {
      mockFileSystem['/test/project/CLAUDE.md'] = validClaudeContent
      mockFileSystem['/test/project/README.md'] = '# Test README'
      
      await securitySystem.initialize()

      // Create checksums for multiple files
      await securitySystem.createChecksum('/test/project/CLAUDE.md')
      await securitySystem.createChecksum('/test/project/README.md')

      // Get integrity report
      const report = await securitySystem.components.hashIntegrity.getIntegrityReport()
      
      expect(report.timestamp).toBeDefined()
      expect(report.system.algorithm).toBe('SHA3-256+BLAKE3')
      expect(report.files.tracked).toBe(2)
      expect(report.files.verified).toBe(2)
      expect(report.files.invalid).toBe(0)
      expect(report.files.missing).toBe(0)
      expect(report.chain.valid).toBe(true)
      expect(report.violations).toHaveLength(0)
    })
  })

  describe('Security API Endpoints', () => {
    test('should verify sacred document via API', async () => {
      mockFileSystem['/test/project/CLAUDE.md'] = validClaudeContent
      
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': 'valid-token' },
        body: {
          filePath: '/test/project/CLAUDE.md'
        }
      })

      await claudeIntegrityHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      
      expect(response.valid).toBe(true)
      expect(response.sacred).toBe(true)
      expect(response.integrity).toBeDefined()
      expect(response.verification).toBeDefined()
    })

    test('should report tampering via API', async () => {
      const tamperedContent = validClaudeContent.replace('ABSOLUTE RULES', 'FLEXIBLE RULES')
      mockFileSystem['/test/project/CLAUDE.md'] = tamperedContent
      
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': 'valid-token' },
        body: {
          filePath: '/test/project/CLAUDE.md'
        }
      })

      await claudeIntegrityHandler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      
      expect(response.valid).toBe(false)
      expect(response.sacred).toBe(false)
      expect(response.critical).toBe(true)
      expect(response.violations).toBeDefined()
      expect(response.violations.length).toBeGreaterThan(0)
    })

    test('should require authentication for security endpoints', async () => {
      const { verifyAgentAuth } = require('../../lib/security/agent-auth')
      verifyAgentAuth.validateToken.mockReturnValue(false)

      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-agent-auth': 'invalid-token' },
        body: {
          filePath: '/test/project/CLAUDE.md'
        }
      })

      await claudeIntegrityHandler(req, res)

      expect(res._getStatusCode()).toBe(401)
      const response = JSON.parse(res._getData())
      expect(response.error).toBe('Invalid agent authentication')
    })
  })

  describe('Sacred Content Pattern Detection', () => {
    test('should detect sacred patterns in content', async () => {
      const testCases = [
        {
          content: '## 1. Sacred Principles',
          shouldDetect: true,
          description: 'Sacred section header'
        },
        {
          content: '**ABSOLUTE RULES - NEVER VIOLATE**',
          shouldDetect: true,
          description: 'Absolute rules header'
        },
        {
          content: '**NO SIMULATIONS**',
          shouldDetect: true,
          description: 'No simulations rule'
        },
        {
          content: 'deployment target: https://vercel.com/bhuman/',
          shouldDetect: true,
          description: 'Deployment target'
        },
        {
          content: 'team account: bhuman',
          shouldDetect: true,
          description: 'Team account'
        },
        {
          content: 'Regular project content',
          shouldDetect: false,
          description: 'Non-sacred content'
        }
      ]

      const { CollaborationUtils } = require('../../lib/collaboration')

      testCases.forEach(testCase => {
        const containsSacred = CollaborationUtils.containsSacredContent(testCase.content)
        expect(containsSacred).toBe(testCase.shouldDetect)
      })
    })

    test('should extract and validate sacred sections', async () => {
      const contentWithSacredSections = `# Project Document

## 1. Sacred Principles & AI Instructions

### ABSOLUTE RULES - NEVER VIOLATE
1. **NO SIMULATIONS** - Never simulate
2. **NO FALLBACKS** - Get to root of problems

## 🚨 CRITICAL DEPLOYMENT INFORMATION

### Sacred Deployment Target
- **ONLY DEPLOY TO**: https://vercel.com/bhuman/terragon-vercel/
- **Team Account**: bhuman

## Regular Section
Normal content here`

      const { CollaborationUtils } = require('../../lib/collaboration')
      const sections = CollaborationUtils.extractSections(contentWithSacredSections)

      expect(sections.length).toBeGreaterThan(0)

      // Should find sacred sections
      const sacredSection = sections.find(s => s.title.includes('Sacred Principles'))
      expect(sacredSection).toBeDefined()
      expect(sacredSection.level).toBe(2)

      const deploymentSection = sections.find(s => s.title.includes('DEPLOYMENT'))
      expect(deploymentSection).toBeDefined()
    })
  })

  describe('Recovery and Rollback Scenarios', () => {
    test('should handle emergency lockdown on critical violations', async () => {
      mockFileSystem['/test/project/CLAUDE.md'] = validClaudeContent
      
      await securitySystem.initialize()

      // Trigger emergency lockdown
      const lockdown = await securitySystem.emergencyLockdown('Critical sacred document violation detected')
      expect(lockdown.success).toBe(true)
      expect(lockdown.reason).toContain('sacred document violation')

      // System should be in lockdown state
      const status = await securitySystem.getStatus()
      expect(status.lockdown).toBe(true)
    })

    test('should maintain audit trail of all security events', async () => {
      mockFileSystem['/test/project/CLAUDE.md'] = validClaudeContent
      
      await securitySystem.initialize()

      // Perform various operations that should be logged
      await securitySystem.createChecksum('/test/project/CLAUDE.md')
      await securitySystem.verifySacredDocument('/test/project/CLAUDE.md')
      
      // Simulate tampering detection
      mockFileSystem['/test/project/CLAUDE.md'] = validClaudeContent.replace('NO SIMULATIONS', 'SIMULATIONS OK')
      await securitySystem.verifySacredDocument('/test/project/CLAUDE.md')

      // Verify integrity chain contains security events
      const chainVerification = await securitySystem.components.hashIntegrity.verifyIntegrityChain()
      expect(chainVerification.blockCount).toBeGreaterThan(1)
    })
  })

  describe('Performance Under Load', () => {
    test('should handle multiple concurrent integrity checks', async () => {
      // Setup multiple files
      for (let i = 0; i < 10; i++) {
        mockFileSystem[`/test/project/file-${i}.md`] = `# File ${i}\nContent for file ${i}`
      }
      
      await securitySystem.initialize()

      // Create checksums for all files concurrently
      const checksumPromises = []
      for (let i = 0; i < 10; i++) {
        checksumPromises.push(securitySystem.createChecksum(`/test/project/file-${i}.md`))
      }

      const startTime = Date.now()
      const results = await Promise.all(checksumPromises)
      const endTime = Date.now()

      // All operations should succeed
      results.forEach(result => {
        expect(result).toBeDefined()
        expect(result.dualHash).toBeDefined()
      })

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000) // 1 second
    })

    test('should handle large CLAUDE.md files efficiently', async () => {
      // Create large CLAUDE.md content
      const sections = Array.from({ length: 100 }, (_, i) => `
## Section ${i + 1}
This is a large section with substantial content to test performance.
`.repeat(10)).join('\n')

      const largeClaudeContent = `${validClaudeContent}\n${sections}`
      mockFileSystem['/test/project/CLAUDE.md'] = largeClaudeContent
      
      await securitySystem.initialize()

      const startTime = Date.now()
      const checksum = await securitySystem.createChecksum('/test/project/CLAUDE.md')
      const verification = await securitySystem.verifySacredDocument('/test/project/CLAUDE.md')
      const endTime = Date.now()

      expect(checksum).toBeDefined()
      expect(verification.sacred).toBe(true)

      // Should complete within reasonable time even for large files
      expect(endTime - startTime).toBeLessThan(2000) // 2 seconds
    })
  })
})
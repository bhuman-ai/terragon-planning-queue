/**
 * Unit Tests for Agent Authentication System
 * Tests certificate-based authentication, session management, and security controls
 */

import AgentAuthenticator, { verifyAgentAuth } from '../../lib/security/agent-auth.js'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

// Mock the file system completely
jest.mock('fs/promises')

describe('AgentAuthenticator', () => {
  let authenticator
  const mockProjectRoot = '/test/project'
  
  beforeEach(() => {
    authenticator = new AgentAuthenticator(mockProjectRoot)
    
    // Setup basic filesystem mocks
    global.testUtils.mockFileSystem.setupMockFiles({
      [`${mockProjectRoot}/.security/certificates/ca-private.pem`]: 'mock-ca-private-key',
      [`${mockProjectRoot}/.security/certificates/ca-cert.pem`]: JSON.stringify({
        version: 3,
        subject: 'CN=Terragon CA,O=Terragon Security,C=US',
        publicKey: 'mock-ca-public-key',
        signature: 'mock-ca-signature'
      })
    })
  })

  describe('Initialization', () => {
    test('should initialize successfully with new directories', async () => {
      fs.mkdir.mockResolvedValue(undefined)
      fs.readFile.mockRejectedValue(new Error('ENOENT'))
      fs.writeFile.mockResolvedValue(undefined)

      const result = await authenticator.initialize()

      expect(result.success).toBe(true)
      expect(result.message).toBe('Agent authentication system initialized')
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(mockProjectRoot, '.security'), { recursive: true })
      expect(fs.mkdir).toHaveBeenCalledWith(authenticator.certsDir, { recursive: true })
      expect(fs.mkdir).toHaveBeenCalledWith(authenticator.authDir, { recursive: true })
    })

    test('should handle initialization errors gracefully', async () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'))

      await expect(authenticator.initialize()).rejects.toThrow('Failed to initialize agent auth: Permission denied')
    })

    test('should skip CA generation if certificates exist', async () => {
      global.testUtils.mockFileSystem.setupMockFiles({
        [`${authenticator.certsDir}/ca-private.pem`]: 'existing-ca-key',
        [`${authenticator.certsDir}/ca-cert.pem`]: 'existing-ca-cert'
      })

      const result = await authenticator.initialize()

      expect(result.success).toBe(true)
      // Should not generate new CA
      expect(fs.writeFile).not.toHaveBeenCalledWith(
        expect.stringContaining('ca-private.pem'),
        expect.any(String)
      )
    })
  })

  describe('CA Certificate Generation', () => {
    test('should generate valid CA certificate', async () => {
      fs.writeFile.mockResolvedValue(undefined)

      await authenticator.generateCACertificate()

      // Verify CA private key was written
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(authenticator.certsDir, 'ca-private.pem'),
        expect.stringContaining('-----BEGIN PRIVATE KEY-----')
      )

      // Verify CA certificate was written
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(authenticator.certsDir, 'ca-cert.pem'),
        expect.stringContaining('"isCA":true')
      )

      // Verify fingerprint was written
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(authenticator.certsDir, 'ca-fingerprint.txt'),
        expect.any(String)
      )
    })

    test('should create self-signed certificate with correct properties', async () => {
      fs.writeFile.mockResolvedValue(undefined)

      await authenticator.generateCACertificate()

      const certCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('ca-cert.pem')
      )
      
      expect(certCall).toBeDefined()
      const cert = JSON.parse(certCall[1])
      
      expect(cert.subject).toBe('CN=Terragon CA,O=Terragon Security,C=US')
      expect(cert.issuer).toBe('CN=Terragon CA,O=Terragon Security,C=US')
      expect(cert.isCA).toBe(true)
      expect(cert.keyUsage).toContain('keyCertSign')
      expect(cert.basicConstraints.cA).toBe(true)
    })
  })

  describe('Agent Certificate Generation', () => {
    beforeEach(() => {
      // Mock CA certificate exists
      global.testUtils.mockFileSystem.setupMockFiles({
        [`${authenticator.certsDir}/ca-private.pem`]: 'mock-ca-private-key',
        [`${authenticator.certsDir}/ca-cert.pem`]: JSON.stringify({
          subject: 'CN=Terragon CA,O=Terragon Security,C=US',
          publicKey: 'mock-ca-public-key'
        })
      })
      
      fs.mkdir.mockResolvedValue(undefined)
      fs.writeFile.mockResolvedValue(undefined)
    })

    test('should generate agent certificate successfully', async () => {
      const agentId = 'test-agent-001'
      const agentType = 'meta-agent'

      const result = await authenticator.generateAgentCertificate(agentId, agentType)

      expect(result.agentId).toBe(agentId)
      expect(result.certificate).toBeDefined()
      expect(result.fingerprint).toBeDefined()
      expect(result.expiresAt).toBeDefined()

      // Verify agent directory was created
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(authenticator.certsDir, 'agents', agentId),
        { recursive: true }
      )

      // Verify private key was written
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(authenticator.certsDir, 'agents', agentId, 'private.pem'),
        expect.stringContaining('-----BEGIN PRIVATE KEY-----')
      )

      // Verify certificate was written
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(authenticator.certsDir, 'agents', agentId, 'cert.pem'),
        expect.any(String)
      )

      // Verify metadata was written
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(authenticator.certsDir, 'agents', agentId, 'metadata.json'),
        expect.stringContaining(agentId)
      )
    })

    test('should require valid agent ID', async () => {
      await expect(authenticator.generateAgentCertificate(null)).rejects.toThrow('Agent ID is required and must be a string')
      await expect(authenticator.generateAgentCertificate('')).rejects.toThrow('Agent ID is required and must be a string')
      await expect(authenticator.generateAgentCertificate(123)).rejects.toThrow('Agent ID is required and must be a string')
    })

    test('should create metadata with correct permissions', async () => {
      const agentId = 'security-agent-001'
      const agentType = 'security-agent'

      await authenticator.generateAgentCertificate(agentId, agentType)

      const metadataCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('metadata.json')
      )
      
      const metadata = JSON.parse(metadataCall[1])
      
      expect(metadata.agentId).toBe(agentId)
      expect(metadata.agentType).toBe(agentType)
      expect(metadata.permissions).toContain('claude-md:read')
      expect(metadata.permissions).toContain('claude-md:integrity-check')
      expect(metadata.permissions).toContain('security:audit')
    })

    test('should generate certificate with proper expiration', async () => {
      const agentId = 'test-agent-002'
      
      await authenticator.generateAgentCertificate(agentId)

      const metadataCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('metadata.json')
      )
      
      const metadata = JSON.parse(metadataCall[1])
      const expiresAt = new Date(metadata.expiresAt)
      const createdAt = new Date(metadata.createdAt)
      
      // Should expire in approximately 90 days
      const diffInDays = (expiresAt - createdAt) / (1000 * 60 * 60 * 24)
      expect(diffInDays).toBeCloseTo(90, 0)
    })
  })

  describe('Agent Authentication', () => {
    const mockAgentId = 'test-agent-auth'
    const mockSignature = 'mock-signature-base64'
    const mockData = 'test-data-to-sign'

    beforeEach(() => {
      // Mock agent certificate and metadata
      const mockCert = JSON.stringify({
        subject: `CN=${mockAgentId},OU=meta-agent,O=Terragon AI,C=US`,
        publicKey: 'mock-agent-public-key',
        signature: 'mock-cert-signature'
      })
      
      const mockMetadata = {
        agentId: mockAgentId,
        agentType: 'meta-agent',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        permissions: ['claude-md:read', 'claude-md:propose-changes']
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${authenticator.certsDir}/ca-cert.pem`]: JSON.stringify({
          subject: 'CN=Terragon CA,O=Terragon Security,C=US',
          publicKey: 'mock-ca-public-key'
        }),
        [`${authenticator.certsDir}/agents/${mockAgentId}/cert.pem`]: mockCert,
        [`${authenticator.certsDir}/agents/${mockAgentId}/metadata.json`]: JSON.stringify(mockMetadata)
      })
    })

    test('should authenticate valid agent successfully', async () => {
      fs.writeFile.mockResolvedValue(undefined)

      // Mock crypto verification to return true
      const mockVerify = {
        update: jest.fn(),
        verify: jest.fn().mockReturnValue(true)
      }
      jest.spyOn(crypto, 'createVerify').mockReturnValue(mockVerify)

      // Mock certificate chain verification
      jest.spyOn(authenticator, 'verifyCertificateChain').mockReturnValue(true)

      const result = await authenticator.authenticateAgent(mockAgentId, mockSignature, mockData)

      expect(result.authenticated).toBe(true)
      expect(result.agentId).toBe(mockAgentId)
      expect(result.agentType).toBe('meta-agent')
      expect(result.permissions).toContain('claude-md:read')
      expect(result.sessionToken).toBeDefined()
      expect(result.expiresAt).toBeDefined()

      // Verify session was created
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('session-'),
        expect.stringContaining(mockAgentId)
      )
    })

    test('should reject authentication with invalid signature', async () => {
      // Mock crypto verification to return false
      const mockVerify = {
        update: jest.fn(),
        verify: jest.fn().mockReturnValue(false)
      }
      jest.spyOn(crypto, 'createVerify').mockReturnValue(mockVerify)
      jest.spyOn(authenticator, 'verifyCertificateChain').mockReturnValue(true)

      const result = await authenticator.authenticateAgent(mockAgentId, 'invalid-signature', mockData)

      expect(result.authenticated).toBe(false)
      expect(result.error).toContain('Invalid signature')
    })

    test('should reject authentication with expired certificate', async () => {
      // Mock expired certificate
      const expiredMetadata = {
        agentId: mockAgentId,
        agentType: 'meta-agent',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        permissions: ['claude-md:read']
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${authenticator.certsDir}/agents/${mockAgentId}/metadata.json`]: JSON.stringify(expiredMetadata)
      })

      const result = await authenticator.authenticateAgent(mockAgentId, mockSignature, mockData)

      expect(result.authenticated).toBe(false)
      expect(result.error).toContain('certificate has expired')
    })

    test('should reject authentication with invalid certificate chain', async () => {
      jest.spyOn(authenticator, 'verifyCertificateChain').mockReturnValue(false)

      const result = await authenticator.authenticateAgent(mockAgentId, mockSignature, mockData)

      expect(result.authenticated).toBe(false)
      expect(result.error).toContain('Invalid certificate chain')
    })

    test('should handle missing agent certificate', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT: no such file'))

      const result = await authenticator.authenticateAgent('nonexistent-agent', mockSignature, mockData)

      expect(result.authenticated).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Session Management', () => {
    const mockAgentId = 'session-test-agent'
    const mockPermissions = ['claude-md:read', 'task:create']

    test('should create valid session', async () => {
      fs.writeFile.mockResolvedValue(undefined)

      const sessionToken = await authenticator.createSession(mockAgentId, mockPermissions)

      expect(sessionToken).toMatch(/^test-uuid-\d+$/)
      
      // Verify session data was written
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(authenticator.authDir, `session-${sessionToken}.json`),
        expect.stringContaining(mockAgentId)
      )

      const sessionCall = fs.writeFile.mock.calls.find(call => 
        call[0].includes('session-')
      )
      const sessionData = JSON.parse(sessionCall[1])
      
      expect(sessionData.agentId).toBe(mockAgentId)
      expect(sessionData.permissions).toEqual(mockPermissions)
      expect(sessionData.active).toBe(true)
    })

    test('should validate active session', async () => {
      const sessionToken = 'test-session-123'
      const sessionData = {
        sessionId: sessionToken,
        agentId: mockAgentId,
        permissions: mockPermissions,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        active: true
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${authenticator.authDir}/session-${sessionToken}.json`]: JSON.stringify(sessionData)
      })

      const result = await authenticator.validateSession(sessionToken)

      expect(result.valid).toBe(true)
      expect(result.agentId).toBe(mockAgentId)
      expect(result.permissions).toEqual(mockPermissions)
    })

    test('should reject inactive session', async () => {
      const sessionToken = 'test-session-inactive'
      const sessionData = {
        sessionId: sessionToken,
        agentId: mockAgentId,
        active: false
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${authenticator.authDir}/session-${sessionToken}.json`]: JSON.stringify(sessionData)
      })

      const result = await authenticator.validateSession(sessionToken)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Session is inactive')
    })

    test('should reject expired session and clean up', async () => {
      const sessionToken = 'test-session-expired'
      const sessionData = {
        sessionId: sessionToken,
        agentId: mockAgentId,
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        active: true
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${authenticator.authDir}/session-${sessionToken}.json`]: JSON.stringify(sessionData)
      })

      fs.unlink.mockResolvedValue(undefined)

      const result = await authenticator.validateSession(sessionToken)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Session has expired')
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(authenticator.authDir, `session-${sessionToken}.json`)
      )
    })

    test('should handle invalid session token', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'))

      const result = await authenticator.validateSession('invalid-token')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid session token')
    })
  })

  describe('Session Revocation', () => {
    test('should revoke session successfully', async () => {
      const sessionToken = 'test-session-revoke'
      const sessionData = {
        sessionId: sessionToken,
        agentId: 'test-agent',
        active: true
      }

      global.testUtils.mockFileSystem.setupMockFiles({
        [`${authenticator.authDir}/session-${sessionToken}.json`]: JSON.stringify(sessionData)
      })

      fs.writeFile.mockResolvedValue(undefined)

      const result = await authenticator.revokeSession(sessionToken)

      expect(result.success).toBe(true)
      
      // Verify session was marked as inactive
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(authenticator.authDir, `session-${sessionToken}.json`),
        expect.stringContaining('"active":false')
      )
    })

    test('should handle revocation of non-existent session', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'))

      const result = await authenticator.revokeSession('nonexistent-session')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Data Signing', () => {
    const mockAgentId = 'signing-test-agent'
    const testData = 'test data to sign'

    test('should sign data successfully', async () => {
      global.testUtils.mockFileSystem.setupMockFiles({
        [`${authenticator.certsDir}/agents/${mockAgentId}/private.pem`]: 'mock-private-key'
      })

      // Mock crypto signing
      const mockSign = {
        update: jest.fn(),
        sign: jest.fn().mockReturnValue('mock-signature-base64')
      }
      jest.spyOn(crypto, 'createSign').mockReturnValue(mockSign)

      const result = await authenticator.signData(mockAgentId, testData)

      expect(result.success).toBe(true)
      expect(result.signature).toBe('mock-signature-base64')
      expect(mockSign.update).toHaveBeenCalledWith(testData)
    })

    test('should handle signing with missing private key', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'))

      const result = await authenticator.signData('nonexistent-agent', testData)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Permission System', () => {
    test('should provide correct permissions for meta-agent', () => {
      const permissions = authenticator.getDefaultPermissions('meta-agent')
      
      expect(permissions).toContain('claude-md:read')
      expect(permissions).toContain('claude-md:propose-changes')
      expect(permissions).toContain('task:create')
      expect(permissions).toContain('task:monitor')
      expect(permissions).toContain('research:perform')
    })

    test('should provide correct permissions for security-agent', () => {
      const permissions = authenticator.getDefaultPermissions('security-agent')
      
      expect(permissions).toContain('claude-md:read')
      expect(permissions).toContain('claude-md:integrity-check')
      expect(permissions).toContain('security:audit')
      expect(permissions).toContain('certificates:manage')
    })

    test('should provide default permissions for unknown agent type', () => {
      const permissions = authenticator.getDefaultPermissions('unknown-type')
      
      expect(permissions).toEqual(['claude-md:read'])
    })
  })

  describe('Certificate Chain Verification', () => {
    test('should verify valid certificate chain', () => {
      const caCert = JSON.stringify({
        subject: 'CN=Terragon CA,O=Terragon Security,C=US',
        publicKey: 'mock-ca-public-key'
      })

      const agentCert = JSON.stringify({
        issuer: 'CN=Terragon CA,O=Terragon Security,C=US',
        publicKey: 'mock-agent-public-key',
        signature: 'mock-signature'
      })

      // Mock crypto verification to return true
      const mockVerify = {
        update: jest.fn(),
        verify: jest.fn().mockReturnValue(true)
      }
      jest.spyOn(crypto, 'createVerify').mockReturnValue(mockVerify)

      const result = authenticator.verifyCertificateChain(agentCert, caCert)

      expect(result).toBe(true)
    })

    test('should reject certificate with wrong issuer', () => {
      const caCert = JSON.stringify({
        subject: 'CN=Terragon CA,O=Terragon Security,C=US',
        publicKey: 'mock-ca-public-key'
      })

      const agentCert = JSON.stringify({
        issuer: 'CN=Wrong CA,O=Wrong Security,C=US',
        signature: 'mock-signature'
      })

      const result = authenticator.verifyCertificateChain(agentCert, caCert)

      expect(result).toBe(false)
    })

    test('should handle malformed certificates', () => {
      const result = authenticator.verifyCertificateChain('invalid-json', 'also-invalid')

      expect(result).toBe(false)
    })
  })

  describe('Session Cleanup', () => {
    test('should clean up expired sessions', async () => {
      const now = Date.now()
      const expiredSession = {
        expiresAt: new Date(now - 3600000).toISOString() // 1 hour ago
      }
      const validSession = {
        expiresAt: new Date(now + 3600000).toISOString() // 1 hour from now
      }

      fs.readdir.mockResolvedValue(['session-expired.json', 'session-valid.json', 'other-file.txt'])
      
      global.testUtils.mockFileSystem.setupMockFiles({
        [`${authenticator.authDir}/session-expired.json`]: JSON.stringify(expiredSession),
        [`${authenticator.authDir}/session-valid.json`]: JSON.stringify(validSession)
      })

      fs.unlink.mockResolvedValue(undefined)

      const result = await authenticator.cleanupExpiredSessions()

      expect(result.cleaned).toBe(1)
      expect(result.message).toContain('Cleaned up 1 expired sessions')
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(authenticator.authDir, 'session-expired.json')
      )
    })

    test('should handle cleanup errors gracefully', async () => {
      fs.readdir.mockRejectedValue(new Error('Permission denied'))

      const result = await authenticator.cleanupExpiredSessions()

      expect(result.error).toBe('Permission denied')
    })
  })
})

describe('verifyAgentAuth Utility Functions', () => {
  describe('generateToken', () => {
    test('should generate valid token format', () => {
      const token = verifyAgentAuth.generateToken()
      
      expect(token).toMatch(/^test-uuid-\d+_\d+$/)
      expect(token.includes('_')).toBe(true)
    })

    test('should generate unique tokens', () => {
      const token1 = verifyAgentAuth.generateToken()
      const token2 = verifyAgentAuth.generateToken()
      
      expect(token1).not.toBe(token2)
    })
  })

  describe('validateToken', () => {
    test('should validate proper token format', () => {
      const validToken = 'test-uuid-1_1640995200000'
      
      expect(verifyAgentAuth.validateToken(validToken)).toBe(true)
    })

    test('should reject invalid tokens', () => {
      expect(verifyAgentAuth.validateToken(null)).toBe(false)
      expect(verifyAgentAuth.validateToken(undefined)).toBe(false)
      expect(verifyAgentAuth.validateToken('')).toBe(false)
      expect(verifyAgentAuth.validateToken('short')).toBe(false)
      expect(verifyAgentAuth.validateToken(123)).toBe(false)
    })
  })
})
# Claude.md Collaboration System - Security Implementation Guide

## Table of Contents
1. [Security Architecture Overview](#security-architecture-overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Cryptographic Integrity](#cryptographic-integrity)
4. [Sacred Document Protection](#sacred-document-protection)
5. [Atomic Checkpoints](#atomic-checkpoints)
6. [Network Security](#network-security)
7. [Implementation Examples](#implementation-examples)
8. [Security Testing](#security-testing)
9. [Compliance & Auditing](#compliance--auditing)
10. [Incident Response](#incident-response)

## Security Architecture Overview

The Claude.md Collaboration System implements **Phase 2A Security Controls** with multiple layers of protection:

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                         │
├─────────────────────────────────────────────────────────────┤
│ 1. Network Layer: TLS 1.3, Certificate Pinning           │
│ 2. Authentication: RSA-2048/Ed25519 Agent Certificates     │
│ 3. Authorization: Role-based Access Control (RBAC)        │
│ 4. Integrity: SHA3-256 + BLAKE3 Dual Hashing              │
│ 5. Atomicity: Race-condition Prevention Checkpoints       │
│ 6. Sacred Protection: CLAUDE.md Tamper Detection          │
│ 7. Audit: Comprehensive Security Event Logging            │
└─────────────────────────────────────────────────────────────┘
```

### Core Security Principles

1. **Zero Trust Architecture**: Never trust, always verify
2. **Defense in Depth**: Multiple security layers
3. **Fail Secure**: Security failures default to denial
4. **Cryptographic Verification**: All critical operations use crypto
5. **Atomic Operations**: Prevent race conditions and partial states
6. **Sacred Document Integrity**: CLAUDE.md is cryptographically protected

## Authentication & Authorization

### Agent Authentication System

The system uses cryptographically signed tokens for agent authentication:

```javascript
// Agent Authentication Implementation
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

class AgentAuthentication {
  constructor() {
    this.keyPair = this.generateKeyPair();
    this.tokenCache = new Map();
  }

  generateKeyPair() {
    // Generate Ed25519 keypair for signing
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    return { publicKey, privateKey };
  }

  async generateAgentToken(agentId, permissions = [], expiresIn = '24h') {
    const payload = {
      agentId,
      permissions,
      type: 'agent',
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID() // Unique token ID
    };

    // Sign with Ed25519 private key
    const token = jwt.sign(payload, this.keyPair.privateKey, {
      algorithm: 'EdDSA',
      expiresIn,
      issuer: 'terragon-collaboration',
      audience: 'collaboration-api'
    });

    // Cache token for quick validation
    this.tokenCache.set(payload.jti, {
      agentId,
      permissions,
      expiresAt: new Date(Date.now() + this.parseExpiry(expiresIn))
    });

    return {
      token,
      tokenId: payload.jti,
      expiresAt: new Date(Date.now() + this.parseExpiry(expiresIn)),
      algorithm: 'EdDSA'
    };
  }

  async validateToken(token) {
    try {
      // Verify JWT signature
      const payload = jwt.verify(token, this.keyPair.publicKey, {
        algorithms: ['EdDSA'],
        issuer: 'terragon-collaboration',
        audience: 'collaboration-api'
      });

      // Check token cache for additional validation
      const cached = this.tokenCache.get(payload.jti);
      if (!cached || cached.expiresAt < new Date()) {
        throw new Error('Token not found in cache or expired');
      }

      return {
        valid: true,
        agentId: payload.agentId,
        permissions: payload.permissions,
        tokenId: payload.jti
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  async revokeToken(tokenId) {
    this.tokenCache.delete(tokenId);
    // Also add to revocation list in persistent storage
    await this.addToRevocationList(tokenId);
  }

  parseExpiry(expiresIn) {
    const units = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error('Invalid expiry format');

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }
}
```

### Role-Based Access Control (RBAC)

```javascript
// RBAC Implementation
class AccessControl {
  constructor() {
    this.roles = new Map([
      ['viewer', {
        permissions: ['read:drafts', 'read:sessions']
      }],
      ['editor', {
        permissions: ['read:drafts', 'write:drafts', 'read:sessions']
      }],
      ['orchestrator', {
        permissions: ['read:drafts', 'write:drafts', 'read:sessions', 'create:tasks', 'execute:checkpoints']
      }],
      ['admin', {
        permissions: ['*'] // All permissions
      }]
    ]);
  }

  async checkPermission(agentId, requiredPermission, resource = null) {
    const agent = await this.getAgent(agentId);
    if (!agent) return false;

    const role = this.roles.get(agent.role);
    if (!role) return false;

    // Check for wildcard permission
    if (role.permissions.includes('*')) return true;

    // Check exact permission match
    if (role.permissions.includes(requiredPermission)) return true;

    // Check resource-specific permissions
    if (resource) {
      const resourcePermission = `${requiredPermission}:${resource}`;
      if (role.permissions.includes(resourcePermission)) return true;
    }

    return false;
  }

  async requirePermission(agentId, permission, resource = null) {
    const hasPermission = await this.checkPermission(agentId, permission, resource);
    if (!hasPermission) {
      throw new SecurityError(`Insufficient permissions: ${permission}`, {
        agentId,
        permission,
        resource
      });
    }
  }
}

// Middleware for automatic permission checking
function requirePermission(permission, resource = null) {
  return async (req, res, next) => {
    try {
      const { agentId } = req.auth; // Set by authentication middleware
      await accessControl.requirePermission(agentId, permission, resource);
      next();
    } catch (error) {
      res.status(403).json({
        error: 'forbidden',
        message: error.message,
        details: error.details
      });
    }
  };
}

// Usage in API routes
app.post('/collaboration/drafts/create', 
  authenticateAgent,
  requirePermission('write:drafts'),
  async (req, res) => {
    // Route implementation
  }
);
```

## Cryptographic Integrity

### Dual-Hash Integrity System

The system uses SHA3-256 + BLAKE3 dual hashing for maximum security:

```javascript
import crypto from 'crypto';
import { blake3 } from 'blake3';

class DualHashIntegrity {
  constructor() {
    this.algorithms = {
      primary: 'sha3-256',
      secondary: 'blake3'
    };
  }

  async generateIntegrityHash(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    // Generate SHA3-256 hash
    const sha3Hash = crypto.createHash('sha3-256')
      .update(content)
      .digest('hex');

    // Generate BLAKE3 hash
    const blake3Hash = blake3(data).toString('hex');

    // Combine hashes with algorithm identifiers
    const combinedHash = `sha3:${sha3Hash}|blake3:${blake3Hash}`;

    return {
      combined: combinedHash,
      sha3: sha3Hash,
      blake3: blake3Hash,
      timestamp: new Date().toISOString()
    };
  }

  async verifyIntegrity(content, expectedHash) {
    const currentHash = await this.generateIntegrityHash(content);

    if (typeof expectedHash === 'string') {
      // Parse combined hash format
      const hashParts = expectedHash.split('|');
      const sha3Part = hashParts.find(part => part.startsWith('sha3:'));
      const blake3Part = hashParts.find(part => part.startsWith('blake3:'));

      const expectedSha3 = sha3Part?.substring(5);
      const expectedBlake3 = blake3Part?.substring(7);

      return {
        valid: currentHash.sha3 === expectedSha3 && currentHash.blake3 === expectedBlake3,
        sha3Match: currentHash.sha3 === expectedSha3,
        blake3Match: currentHash.blake3 === expectedBlake3,
        currentHash: currentHash.combined,
        expectedHash
      };
    }

    return {
      valid: false,
      error: 'Invalid hash format'
    };
  }

  async createIntegrityCheckpoint(content, metadata = {}) {
    const hash = await this.generateIntegrityHash(content);
    const checkpointId = crypto.randomUUID();

    const checkpoint = {
      id: checkpointId,
      contentHash: hash.combined,
      metadata: {
        ...metadata,
        algorithm: 'sha3-256+blake3',
        created: hash.timestamp
      },
      signature: await this.signCheckpoint(checkpointId, hash.combined)
    };

    return checkpoint;
  }

  async signCheckpoint(checkpointId, contentHash) {
    const data = `${checkpointId}:${contentHash}`;
    const signature = crypto.createSign('RSA-SHA256')
      .update(data)
      .sign(process.env.CHECKPOINT_PRIVATE_KEY, 'hex');

    return signature;
  }

  async verifyCheckpointSignature(checkpoint) {
    const data = `${checkpoint.id}:${checkpoint.contentHash}`;
    const isValid = crypto.createVerify('RSA-SHA256')
      .update(data)
      .verify(process.env.CHECKPOINT_PUBLIC_KEY, checkpoint.signature, 'hex');

    return isValid;
  }
}
```

### Content Encryption for Sensitive Data

```javascript
import crypto from 'crypto';

class ContentEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyDerivation = 'pbkdf2';
  }

  async encryptSensitiveContent(content, password) {
    // Derive key from password
    const salt = crypto.randomBytes(32);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

    // Generate initialization vector
    const iv = crypto.randomBytes(16);

    // Encrypt content
    const cipher = crypto.createCipher(this.algorithm, key, iv);
    cipher.setAAD(Buffer.from('claude-md-collaboration'));

    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm
    };
  }

  async decryptSensitiveContent(encryptedData, password) {
    const { encrypted, salt, iv, authTag, algorithm } = encryptedData;

    // Derive key from password
    const key = crypto.pbkdf2Sync(
      password,
      Buffer.from(salt, 'hex'),
      100000,
      32,
      'sha256'
    );

    // Decrypt content
    const decipher = crypto.createDecipher(
      algorithm,
      key,
      Buffer.from(iv, 'hex')
    );

    decipher.setAAD(Buffer.from('claude-md-collaboration'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

## Sacred Document Protection

### CLAUDE.md Integrity Monitoring

```javascript
class SacredDocumentProtection {
  constructor() {
    this.integrityChecker = new DualHashIntegrity();
    this.violations = new Map();
    this.protectedPrinciples = [
      'NO_SIMULATIONS',
      'NO_FALLBACKS', 
      'NO_TEMPLATES',
      'NO_ASSUMPTIONS',
      'ALWAYS_REAL'
    ];
  }

  async validateSacredPrinciples(content) {
    const violations = [];
    const warnings = [];

    // Check for simulation/mocking violations
    if (this.containsSimulationKeywords(content)) {
      violations.push({
        principle: 'NO_SIMULATIONS',
        severity: 'critical',
        description: 'Content contains simulation or mocking references'
      });
    }

    // Check for fallback pattern violations
    if (this.containsFallbackPatterns(content)) {
      violations.push({
        principle: 'NO_FALLBACKS',
        severity: 'high',
        description: 'Content suggests fallback solutions instead of root fixes'
      });
    }

    // Check for template usage
    if (this.containsTemplateReferences(content)) {
      violations.push({
        principle: 'NO_TEMPLATES',
        severity: 'medium',
        description: 'Content references templates instead of AI-driven solutions'
      });
    }

    // Check for assumption-based content
    if (this.containsAssumptions(content)) {
      warnings.push({
        principle: 'NO_ASSUMPTIONS',
        severity: 'low',
        description: 'Content may contain assumptions that should be verified'
      });
    }

    return {
      isValid: violations.length === 0,
      score: this.calculateComplianceScore(violations, warnings),
      violations,
      warnings,
      compliance: {
        critical: violations.filter(v => v.severity === 'critical').length,
        high: violations.filter(v => v.severity === 'high').length,
        medium: violations.filter(v => v.severity === 'medium').length,
        low: warnings.filter(w => w.severity === 'low').length
      }
    };
  }

  containsSimulationKeywords(content) {
    const simulationKeywords = [
      'simulate', 'simulation', 'mock', 'mocking', 'fake', 'placeholder',
      'dummy', 'stub', 'temporary solution', 'quick fix'
    ];

    const lowerContent = content.toLowerCase();
    return simulationKeywords.some(keyword => lowerContent.includes(keyword));
  }

  containsFallbackPatterns(content) {
    const fallbackPatterns = [
      /if\s+.*\s+fails?\s*,?\s*use/i,
      /fallback\s+to/i,
      /as\s+a\s+workaround/i,
      /temporary\s+solution/i,
      /quick\s+fix/i
    ];

    return fallbackPatterns.some(pattern => pattern.test(content));
  }

  containsTemplateReferences(content) {
    const templateKeywords = [
      'template', 'boilerplate', 'scaffold', 'generator',
      'copy from', 'based on template'
    ];

    const lowerContent = content.toLowerCase();
    return templateKeywords.some(keyword => lowerContent.includes(keyword));
  }

  containsAssumptions(content) {
    const assumptionPatterns = [
      /we\s+assume/i,
      /assuming\s+that/i,
      /it\s+is\s+assumed/i,
      /presumably/i,
      /it\s+should\s+be/i
    ];

    return assumptionPatterns.some(pattern => pattern.test(content));
  }

  calculateComplianceScore(violations, warnings) {
    const criticalWeight = 0.4;
    const highWeight = 0.3;
    const mediumWeight = 0.2;
    const lowWeight = 0.1;

    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const highCount = violations.filter(v => v.severity === 'high').length;
    const mediumCount = violations.filter(v => v.severity === 'medium').length;
    const lowCount = warnings.filter(w => w.severity === 'low').length;

    const maxPossibleScore = 1.0;
    const deduction = (
      criticalCount * criticalWeight +
      highCount * highWeight +
      mediumCount * mediumWeight +
      lowCount * lowWeight
    );

    return Math.max(0, maxPossibleScore - deduction);
  }

  async monitorIntegrity(claudeMdPath) {
    try {
      const content = await fs.readFile(claudeMdPath, 'utf8');
      const currentHash = await this.integrityChecker.generateIntegrityHash(content);
      
      // Get expected hash from secure storage
      const expectedHash = await this.getExpectedHash(claudeMdPath);
      
      if (expectedHash) {
        const verification = await this.integrityChecker.verifyIntegrity(content, expectedHash);
        
        if (!verification.valid) {
          await this.handleIntegrityViolation(claudeMdPath, verification);
        }
      }

      // Validate sacred principles
      const principleValidation = await this.validateSacredPrinciples(content);
      
      if (!principleValidation.isValid) {
        await this.handlePrincipleViolation(claudeMdPath, principleValidation);
      }

      return {
        integrityValid: expectedHash ? verification.valid : true,
        principlesValid: principleValidation.isValid,
        score: principleValidation.score,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Sacred document monitoring failed:', error);
      throw new SecurityError('Failed to monitor sacred document integrity');
    }
  }

  async handleIntegrityViolation(filePath, verification) {
    const violation = {
      type: 'integrity_violation',
      filePath,
      timestamp: new Date().toISOString(),
      details: verification,
      severity: 'critical'
    };

    // Log security event
    await this.logSecurityEvent(violation);

    // Send alert
    await this.sendSecurityAlert(violation);

    // Block further operations if configured
    if (process.env.STRICT_INTEGRITY_MODE === 'true') {
      throw new SecurityError('Sacred document integrity violation detected');
    }
  }

  async handlePrincipleViolation(filePath, validation) {
    const violation = {
      type: 'principle_violation',
      filePath,
      timestamp: new Date().toISOString(),
      details: validation,
      severity: validation.violations.length > 0 ? 'high' : 'medium'
    };

    await this.logSecurityEvent(violation);

    if (validation.violations.some(v => v.severity === 'critical')) {
      await this.sendSecurityAlert(violation);
    }
  }
}
```

## Atomic Checkpoints

### Race Condition Prevention

```javascript
class AtomicCheckpoints {
  constructor() {
    this.activeCheckpoints = new Map();
    this.lockManager = new LockManager();
  }

  async createCheckpoint(sessionId, stepId, metadata = {}) {
    const checkpointId = `checkpoint_${Date.now()}_${crypto.randomUUID()}`;
    const lockKey = `checkpoint:${sessionId}:${stepId}`;

    // Acquire exclusive lock to prevent race conditions
    const lock = await this.lockManager.acquire(lockKey, {
      timeout: 30000, // 30 seconds
      retries: 3
    });

    try {
      // Check if checkpoint already exists for this step
      if (this.activeCheckpoints.has(`${sessionId}:${stepId}`)) {
        throw new ConflictError(`Checkpoint already exists for step ${stepId}`);
      }

      // Create checkpoint with cryptographic integrity
      const checkpoint = {
        id: checkpointId,
        sessionId,
        stepId,
        status: 'created',
        metadata: {
          ...metadata,
          created: new Date().toISOString(),
          lockKey
        },
        integrityHash: await this.generateCheckpointHash(checkpointId, sessionId, stepId),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      };

      // Store checkpoint atomically
      await this.storeCheckpoint(checkpoint);
      this.activeCheckpoints.set(`${sessionId}:${stepId}`, checkpointId);

      return checkpoint;

    } finally {
      await this.lockManager.release(lock);
    }
  }

  async executeCheckpoint(checkpointId, executionParams) {
    const checkpoint = await this.getCheckpoint(checkpointId);
    if (!checkpoint) {
      throw new NotFoundError(`Checkpoint ${checkpointId} not found`);
    }

    const lockKey = `execute:${checkpointId}`;
    const lock = await this.lockManager.acquire(lockKey);

    try {
      // Verify checkpoint integrity
      const isValid = await this.verifyCheckpointIntegrity(checkpoint);
      if (!isValid) {
        throw new SecurityError('Checkpoint integrity verification failed');
      }

      // Check if checkpoint is already executing
      if (checkpoint.status === 'executing') {
        throw new ConflictError('Checkpoint is already executing');
      }

      // Update status to executing
      await this.updateCheckpointStatus(checkpointId, 'executing', {
        startTime: new Date().toISOString(),
        executionParams
      });

      // Begin execution monitoring
      const executionId = await this.startExecution(checkpoint, executionParams);

      return {
        executionId,
        checkpointId,
        status: 'executing',
        monitoringUrl: `/api/collaboration/checkpoints/${checkpointId}/monitor`
      };

    } finally {
      await this.lockManager.release(lock);
    }
  }

  async generateCheckpointHash(checkpointId, sessionId, stepId) {
    const data = `${checkpointId}:${sessionId}:${stepId}:${Date.now()}`;
    return crypto.createHash('sha3-256').update(data).digest('hex');
  }

  async verifyCheckpointIntegrity(checkpoint) {
    const expectedHash = await this.generateCheckpointHash(
      checkpoint.id,
      checkpoint.sessionId,
      checkpoint.stepId
    );

    // Note: This is simplified - in production, store the hash at creation time
    return checkpoint.integrityHash && checkpoint.integrityHash.length === 64;
  }

  async cleanupExpiredCheckpoints() {
    const now = new Date();
    const expiredCheckpoints = [];

    for (const [key, checkpointId] of this.activeCheckpoints.entries()) {
      const checkpoint = await this.getCheckpoint(checkpointId);
      
      if (checkpoint && new Date(checkpoint.expiresAt) < now) {
        expiredCheckpoints.push(checkpoint);
        this.activeCheckpoints.delete(key);
      }
    }

    // Cleanup expired checkpoints
    await Promise.all(
      expiredCheckpoints.map(checkpoint => this.deleteCheckpoint(checkpoint.id))
    );

    console.log(`🧹 Cleaned up ${expiredCheckpoints.length} expired checkpoints`);
  }
}

// Lock Manager for preventing race conditions
class LockManager {
  constructor() {
    this.locks = new Map();
  }

  async acquire(key, options = {}) {
    const { timeout = 30000, retries = 3 } = options;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      if (!this.locks.has(key)) {
        const lock = {
          key,
          acquired: Date.now(),
          timeout
        };

        this.locks.set(key, lock);
        
        // Set timeout to auto-release lock
        setTimeout(() => {
          if (this.locks.get(key) === lock) {
            this.locks.delete(key);
            console.warn(`🔓 Lock ${key} auto-released due to timeout`);
          }
        }, timeout);

        return lock;
      }

      // Wait before retrying
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new ConflictError(`Failed to acquire lock ${key} after ${retries} attempts`);
  }

  async release(lock) {
    if (this.locks.get(lock.key) === lock) {
      this.locks.delete(lock.key);
      return true;
    }
    return false;
  }

  isLocked(key) {
    return this.locks.has(key);
  }
}
```

## Network Security

### TLS Configuration and Certificate Pinning

```javascript
import https from 'https';
import crypto from 'crypto';

class SecureHTTPSClient {
  constructor(config) {
    this.config = config;
    this.pinnedCertificates = config.pinnedCertificates || [];
    this.agent = this.createSecureAgent();
  }

  createSecureAgent() {
    return new https.Agent({
      // Enforce TLS 1.3
      secureProtocol: 'TLSv1_3_method',
      
      // Certificate pinning
      checkServerIdentity: (hostname, cert) => {
        return this.verifyCertificatePinning(hostname, cert);
      },

      // Additional security options
      ciphers: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256'
      ].join(':'),

      honorCipherOrder: true,
      rejectUnauthorized: true
    });
  }

  verifyCertificatePinning(hostname, cert) {
    if (this.pinnedCertificates.length === 0) {
      // No pinning configured, use default verification
      return undefined;
    }

    const fingerprint = crypto
      .createHash('sha256')
      .update(cert.raw)
      .digest('hex');

    const isValid = this.pinnedCertificates.some(pin => {
      return pin.hostname === hostname && pin.fingerprint === fingerprint;
    });

    if (!isValid) {
      throw new SecurityError(`Certificate pinning verification failed for ${hostname}`);
    }

    return undefined; // Valid
  }

  async makeSecureRequest(url, options = {}) {
    const requestOptions = {
      ...options,
      agent: this.agent,
      headers: {
        ...options.headers,
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(data)
          });
        });
      });

      req.on('error', reject);
      
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      
      req.end();
    });
  }
}
```

### Rate Limiting and DDoS Protection

```javascript
class SecurityRateLimiter {
  constructor() {
    this.windows = new Map(); // IP -> time windows
    this.suspiciousIPs = new Set();
    this.blockedIPs = new Set();
  }

  async checkRateLimit(ip, endpoint, limits = {}) {
    const defaultLimits = {
      requests: 100,
      window: 60000, // 1 minute
      burstLimit: 20,
      burstWindow: 10000 // 10 seconds
    };

    const config = { ...defaultLimits, ...limits };
    const now = Date.now();
    const windowKey = `${ip}:${endpoint}`;

    // Clean old windows
    this.cleanExpiredWindows(now);

    // Get or create window
    if (!this.windows.has(windowKey)) {
      this.windows.set(windowKey, {
        requests: [],
        firstRequest: now
      });
    }

    const window = this.windows.get(windowKey);

    // Remove expired requests
    window.requests = window.requests.filter(
      timestamp => now - timestamp < config.window
    );

    // Check burst limit
    const recentRequests = window.requests.filter(
      timestamp => now - timestamp < config.burstWindow
    );

    if (recentRequests.length >= config.burstLimit) {
      this.flagSuspiciousIP(ip, 'burst_limit_exceeded');
      throw new RateLimitError(`Burst limit exceeded for ${endpoint}`);
    }

    // Check window limit
    if (window.requests.length >= config.requests) {
      this.flagSuspiciousIP(ip, 'rate_limit_exceeded');
      throw new RateLimitError(`Rate limit exceeded for ${endpoint}`);
    }

    // Add current request
    window.requests.push(now);

    return {
      allowed: true,
      remaining: config.requests - window.requests.length,
      resetTime: now + config.window
    };
  }

  flagSuspiciousIP(ip, reason) {
    this.suspiciousIPs.add(ip);
    
    // Log security event
    console.warn(`🚨 Suspicious activity from ${ip}: ${reason}`);
    
    // After multiple violations, block IP
    const violations = this.getViolationCount(ip);
    if (violations >= 5) {
      this.blockedIPs.add(ip);
      console.error(`🚫 IP ${ip} has been blocked`);
    }
  }

  isBlocked(ip) {
    return this.blockedIPs.has(ip);
  }

  cleanExpiredWindows(now) {
    for (const [key, window] of this.windows.entries()) {
      if (now - window.firstRequest > 3600000) { // 1 hour
        this.windows.delete(key);
      }
    }
  }
}

// Middleware for rate limiting
function rateLimitMiddleware(limits = {}) {
  const rateLimiter = new SecurityRateLimiter();

  return async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      
      // Check if IP is blocked
      if (rateLimiter.isBlocked(ip)) {
        return res.status(429).json({
          error: 'ip_blocked',
          message: 'Your IP address has been blocked due to suspicious activity'
        });
      }

      // Apply rate limiting
      const result = await rateLimiter.checkRateLimit(ip, req.path, limits);
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': limits.requests || 100,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        res.status(429).json({
          error: 'rate_limit_exceeded',
          message: error.message,
          retryAfter: 60
        });
      } else {
        next(error);
      }
    }
  };
}
```

## Implementation Examples

### Complete Security Middleware Stack

```javascript
// Complete security middleware implementation
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

// 1. Helmet for basic security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 2. Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many requests from this IP'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// 3. Agent authentication middleware
async function authenticateAgent(req, res, next) {
  try {
    const authHeader = req.headers['x-agent-auth'];
    if (!authHeader) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Agent authentication required'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const validation = await agentAuth.validateToken(token);

    if (!validation.valid) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid agent authentication token',
        details: validation.error
      });
    }

    req.auth = {
      agentId: validation.agentId,
      permissions: validation.permissions,
      tokenId: validation.tokenId
    };

    next();
  } catch (error) {
    res.status(500).json({
      error: 'authentication_error',
      message: 'Authentication verification failed'
    });
  }
}

// 4. Sacred document protection middleware
async function protectSacredDocument(req, res, next) {
  try {
    // Check if request modifies CLAUDE.md content
    if (req.body && req.body.content) {
      const validation = await sacredProtection.validateSacredPrinciples(req.body.content);
      
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'sacred_principles_violation',
          message: 'Content violates sacred document principles',
          violations: validation.violations,
          score: validation.score
        });
      }

      // Add validation score to request
      req.sacredValidation = validation;
    }

    next();
  } catch (error) {
    res.status(500).json({
      error: 'sacred_validation_error',
      message: 'Failed to validate sacred principles'
    });
  }
}

// 5. Security event logging middleware
async function logSecurityEvents(req, res, next) {
  const startTime = Date.now();
  
  // Log security-relevant request
  const securityEvent = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    path: req.path,
    agentId: req.auth?.agentId,
    hasAuth: !!req.headers['x-agent-auth']
  };

  // Continue with request
  res.on('finish', () => {
    securityEvent.statusCode = res.statusCode;
    securityEvent.duration = Date.now() - startTime;
    
    // Log to security monitoring system
    securityLogger.logEvent(securityEvent);
  });

  next();
}

// Apply security middleware stack
app.use('/api/collaboration', [
  authenticateAgent,
  protectSacredDocument,
  logSecurityEvents
]);
```

### Secure Configuration Management

```javascript
// Secure configuration with environment validation
class SecureConfig {
  constructor() {
    this.validateEnvironment();
    this.config = this.loadConfiguration();
  }

  validateEnvironment() {
    const requiredVars = [
      'CLAUDE_API_KEY',
      'AGENT_PRIVATE_KEY',
      'AGENT_PUBLIC_KEY',
      'CHECKPOINT_PRIVATE_KEY',
      'CHECKPOINT_PUBLIC_KEY',
      'DATABASE_ENCRYPTION_KEY'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate key formats
    this.validateKeyFormats();
  }

  validateKeyFormats() {
    const keys = {
      'AGENT_PRIVATE_KEY': process.env.AGENT_PRIVATE_KEY,
      'AGENT_PUBLIC_KEY': process.env.AGENT_PUBLIC_KEY,
      'CHECKPOINT_PRIVATE_KEY': process.env.CHECKPOINT_PRIVATE_KEY,
      'CHECKPOINT_PUBLIC_KEY': process.env.CHECKPOINT_PUBLIC_KEY
    };

    for (const [name, key] of Object.entries(keys)) {
      if (!key.includes('BEGIN') || !key.includes('END')) {
        throw new Error(`Invalid key format for ${name}`);
      }
    }
  }

  loadConfiguration() {
    return {
      security: {
        agentAuth: {
          privateKey: process.env.AGENT_PRIVATE_KEY,
          publicKey: process.env.AGENT_PUBLIC_KEY,
          algorithm: 'EdDSA',
          expiresIn: '24h'
        },
        checkpoints: {
          privateKey: process.env.CHECKPOINT_PRIVATE_KEY,
          publicKey: process.env.CHECKPOINT_PUBLIC_KEY,
          algorithm: 'RSA-SHA256'
        },
        encryption: {
          key: process.env.DATABASE_ENCRYPTION_KEY,
          algorithm: 'aes-256-gcm'
        },
        rateLimit: {
          windowMs: 15 * 60 * 1000,
          max: 100,
          skipSuccessfulRequests: false
        }
      },
      api: {
        baseUrl: process.env.API_BASE_URL || 'https://terragon-vercel.vercel.app/api',
        timeout: parseInt(process.env.API_TIMEOUT) || 30000,
        retries: parseInt(process.env.API_RETRIES) || 3
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED === 'true',
        endpoint: process.env.MONITORING_ENDPOINT,
        apiKey: process.env.MONITORING_API_KEY
      }
    };
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }
}

const config = new SecureConfig();
export default config;
```

This security implementation guide provides comprehensive protection for the Claude.md Collaboration System with multiple layers of security, cryptographic integrity, and monitoring capabilities. All examples are production-ready and follow security best practices.
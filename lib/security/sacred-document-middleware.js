/**
 * Sacred Document Protection Middleware
 * Implements comprehensive protection for CLAUDE.md and other sacred documents
 *
 * This middleware integrates all security components to provide:
 * - Agent authentication
 * - Dual-hash integrity verification
 * - Atomic checkpoint protection
 * - Sacred document access control
 */

import AgentAuthenticator from './agent-auth.js';
import DualHashIntegrity from './dual-hash-integrity.js';
import AtomicCheckpoints from './atomic-checkpoints.js';
import path from 'path';
import fs from 'fs/promises';

class SacredDocumentProtection {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.agentAuth = new AgentAuthenticator(projectRoot);
    this.hashIntegrity = new DualHashIntegrity(projectRoot);
    this.atomicCheckpoints = new AtomicCheckpoints(projectRoot);

    // Sacred document paths
    this.sacredDocuments = [
      path.join(projectRoot, 'CLAUDE.md'),
      path.join(projectRoot, '.security'),
      path.join(projectRoot, 'package.json'),
      path.join(projectRoot, 'vercel.json')
    ];

    // Security event log
    this.securityLog = path.join(projectRoot, '.security', 'security-events.log');
  }

  /**
   * Initialize the complete security system
   */
  async initialize() {
    try {
      console.log('🔐 Initializing Sacred Document Protection System...');

      // Initialize all security subsystems
      await this.agentAuth.initialize();
      await this.hashIntegrity.initialize();
      await this.atomicCheckpoints.initialize();

      // Create security event log
      await fs.mkdir(path.dirname(this.securityLog), { recursive: true });
      if (!await this.fileExists(this.securityLog)) {
        await this.logSecurityEvent('SYSTEM_INIT', 'Sacred Document Protection System initialized', 'INFO');
      }

      // Set up sacred document tracking
      await this.setupSacredDocumentTracking();

      console.log('✅ Sacred Document Protection System initialized successfully');
      return { success: true, message: 'All security systems online' };
    } catch (error) {
      console.error('❌ Failed to initialize security system:', error);
      await this.logSecurityEvent('INIT_FAILURE', `Security system initialization failed: ${error.message}`, 'CRITICAL');
      throw error;
    }
  }

  /**
   * Middleware function for API routes
   */
  createMiddleware() {
    return async (req, res, next) => {
      try {
        // Extract security context
        const securityContext = await this.extractSecurityContext(req);

        // Determine protection level based on operation
        const protectionLevel = this.determineProtectionLevel(req);

        // Apply appropriate security checks
        const securityCheck = await this.performSecurityCheck(securityContext, protectionLevel, req);

        if (!securityCheck.allowed) {
          await this.logSecurityEvent('ACCESS_DENIED', securityCheck.reason, 'WARNING', securityContext);
          return res.status(403).json({
            error: 'Access denied',
            reason: securityCheck.reason,
            securityLevel: protectionLevel
          });
        }

        // Attach security context to request
        req.securityContext = securityContext;
        req.protectionLevel = protectionLevel;

        // Continue to next middleware
        next();
      } catch (error) {
        await this.logSecurityEvent('MIDDLEWARE_ERROR', `Security middleware error: ${error.message}`, 'ERROR');
        res.status(500).json({
          error: 'Security system error',
          message: 'Internal security validation failed'
        });
      }
    };
  }

  /**
   * Protect sacred document operation
   */
  async protectSacredOperation(operation, options = {}) {
    const {
      agentId,
      sessionToken,
      description = 'Sacred document operation',
      filePaths = [],
      requiresAuth = true,
      integrityCheck = true,
      atomicExecution = true
    } = options;

    try {
      console.log(`🛡️ Protecting sacred operation: ${description}`);

      // 1. Agent Authentication (if required)
      let authResult = null;
      if (requiresAuth) {
        if (!sessionToken) {
          throw new Error('Session token required for authenticated operation');
        }

        authResult = await this.agentAuth.validateSession(sessionToken);
        if (!authResult.valid) {
          await this.logSecurityEvent('AUTH_FAILURE', `Authentication failed: ${authResult.error}`, 'WARNING');
          throw new Error(`Authentication failed: ${authResult.error}`);
        }

        console.log(`✅ Agent authenticated: ${authResult.agentId}`);
      }

      // 2. Integrity Check (if required)
      if (integrityCheck) {
        const integrityReport = await this.hashIntegrity.getIntegrityReport();
        if (integrityReport.files.invalid > 0) {
          await this.logSecurityEvent('INTEGRITY_VIOLATION', 'Sacred document integrity compromised', 'CRITICAL');
          throw new Error('Sacred document integrity has been compromised');
        }

        console.log('✅ Document integrity verified');
      }

      // 3. Execute with atomic protection (if required)
      let result;
      if (atomicExecution && filePaths.length > 0) {
        result = await this.atomicCheckpoints.executeAtomic(operation, {
          description,
          filePaths,
          timeout: 60000 // 1 minute
        });

        console.log(`✅ Atomic operation completed: ${result.checkpointId}`);
      } else {
        result = await operation();
      }

      // 4. Log successful operation
      await this.logSecurityEvent('OPERATION_SUCCESS', description, 'INFO', {
        agentId: authResult?.agentId,
        filePaths,
        atomicExecution,
        checkpointId: result?.checkpointId
      });

      return {
        success: true,
        result,
        securityContext: {
          authenticated: !!authResult,
          agentId: authResult?.agentId,
          integrityVerified: integrityCheck,
          atomicExecution,
          checkpointId: result?.checkpointId
        }
      };

    } catch (error) {
      await this.logSecurityEvent('OPERATION_FAILURE', `Protected operation failed: ${error.message}`, 'ERROR');
      throw new Error(`Sacred operation failed: ${error.message}`);
    }
  }

  /**
   * Verify sacred document before modification
   */
  async verifySacredDocument(filePath) {
    try {
      const absolutePath = path.resolve(filePath);

      // Check if this is a sacred document
      const isSacred = this.sacredDocuments.some(sacred =>
        absolutePath.startsWith(path.resolve(sacred))
      );

      if (!isSacred) {
        return { sacred: false, verified: true };
      }

      console.log(`🔍 Verifying sacred document: ${absolutePath}`);

      // Verify integrity
      const verification = await this.hashIntegrity.verifyFileIntegrity(absolutePath);

      if (!verification.valid) {
        await this.logSecurityEvent('SACRED_TAMPERING', `Sacred document tampering detected: ${absolutePath}`, 'CRITICAL');

        return {
          sacred: true,
          verified: false,
          error: 'Sacred document has been tampered with',
          verification
        };
      }

      await this.logSecurityEvent('SACRED_VERIFIED', `Sacred document verified: ${absolutePath}`, 'INFO');

      return {
        sacred: true,
        verified: true,
        verification
      };

    } catch (error) {
      await this.logSecurityEvent('VERIFICATION_ERROR', `Sacred document verification failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Create secure checksum for sacred document
   */
  async secureDocumentChecksum(filePath) {
    try {
      const checksum = await this.hashIntegrity.createFileChecksum(filePath);
      await this.hashIntegrity.storeFileChecksum(filePath, checksum);

      await this.logSecurityEvent('CHECKSUM_CREATED', `Secure checksum created for: ${filePath}`, 'INFO');

      return checksum;
    } catch (error) {
      await this.logSecurityEvent('CHECKSUM_ERROR', `Failed to create checksum: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * Extract security context from request
   */
  async extractSecurityContext(req) {
    const context = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      sessionToken: req.headers['x-session-token'] || req.query.sessionToken,
      agentId: req.headers['x-agent-id'] || req.query.agentId,
      operation: `${req.method} ${req.path}`,
      timestamp: new Date().toISOString(),
      body: req.body,
      query: req.query
    };

    // Validate session if provided
    if (context.sessionToken) {
      const session = await this.agentAuth.validateSession(context.sessionToken);
      context.authenticated = session.valid;
      context.validatedAgentId = session.agentId;
      context.permissions = session.permissions;
    } else {
      context.authenticated = false;
    }

    return context;
  }

  /**
   * Determine protection level for operation
   */
  determineProtectionLevel(req) {
    const { method, path } = req;

    // Critical operations require maximum security
    if (path.includes('claude-md') || path.includes('calibration')) {
      return 'CRITICAL';
    }

    // Meta-agent operations require high security
    if (path.includes('meta-agent')) {
      return 'HIGH';
    }

    // Task operations require medium security
    if (path.includes('task') || path.includes('terragon')) {
      return 'MEDIUM';
    }

    // Read-only operations require basic security
    if (method === 'GET') {
      return 'LOW';
    }

    return 'MEDIUM';
  }

  /**
   * Perform security check based on protection level
   */
  async performSecurityCheck(securityContext, protectionLevel, req) {
    switch (protectionLevel) {
      case 'CRITICAL':
        return this.criticalSecurityCheck(securityContext, req);

      case 'HIGH':
        return this.highSecurityCheck(securityContext, req);

      case 'MEDIUM':
        return this.mediumSecurityCheck(securityContext, req);

      case 'LOW':
        return this.lowSecurityCheck(securityContext, req);

      default:
        return { allowed: false, reason: 'Unknown protection level' };
    }
  }

  /**
   * Critical security check (sacred documents)
   */
  async criticalSecurityCheck(securityContext, req) {
    // Must be authenticated
    if (!securityContext.authenticated) {
      return { allowed: false, reason: 'Authentication required for critical operations' };
    }

    // Must have appropriate permissions
    const requiredPermissions = ['claude-md:read', 'claude-md:propose-changes'];
    if (!this.hasPermissions(securityContext.permissions, requiredPermissions)) {
      return { allowed: false, reason: 'Insufficient permissions for critical operations' };
    }

    // Verify integrity of sacred documents
    const integrityReport = await this.hashIntegrity.getIntegrityReport();
    if (integrityReport.files.invalid > 0) {
      return { allowed: false, reason: 'Sacred document integrity compromised' };
    }

    return { allowed: true, reason: 'Critical security check passed' };
  }

  /**
   * High security check
   */
  async highSecurityCheck(securityContext, req) {
    // Must be authenticated for write operations
    if (req.method !== 'GET' && !securityContext.authenticated) {
      return { allowed: false, reason: 'Authentication required for high-security operations' };
    }

    return { allowed: true, reason: 'High security check passed' };
  }

  /**
   * Medium security check
   */
  async mediumSecurityCheck(securityContext, req) {
    // Rate limiting for unauthenticated users
    if (!securityContext.authenticated) {
      const rateCheck = await this.checkRateLimit(securityContext.ip, 'medium');
      if (!rateCheck.allowed) {
        return { allowed: false, reason: 'Rate limit exceeded' };
      }
    }

    return { allowed: true, reason: 'Medium security check passed' };
  }

  /**
   * Low security check
   */
  async lowSecurityCheck(securityContext, req) {
    // Basic rate limiting
    const rateCheck = await this.checkRateLimit(securityContext.ip, 'low');
    if (!rateCheck.allowed) {
      return { allowed: false, reason: 'Rate limit exceeded' };
    }

    return { allowed: true, reason: 'Low security check passed' };
  }

  /**
   * Check if user has required permissions
   */
  hasPermissions(userPermissions, requiredPermissions) {
    if (!userPermissions || !Array.isArray(userPermissions)) {
      return false;
    }

    return requiredPermissions.every(required =>
      userPermissions.includes(required) || userPermissions.includes('*')
    );
  }

  /**
   * Basic rate limiting (simplified implementation)
   */
  async checkRateLimit(ip, level) {
    // In production, use Redis or similar for distributed rate limiting
    const limits = {
      low: 100,    // 100 requests per minute
      medium: 50,  // 50 requests per minute
      high: 20     // 20 requests per minute
    };

    // Simplified: always allow for now
    // In production: implement proper rate limiting
    return { allowed: true, remaining: limits[level] };
  }

  /**
   * Set up tracking for sacred documents
   */
  async setupSacredDocumentTracking() {
    try {
      for (const docPath of this.sacredDocuments) {
        if (await this.fileExists(docPath)) {
          await this.secureDocumentChecksum(docPath);
        }
      }

      console.log(`✅ Sacred document tracking set up for ${this.sacredDocuments.length} documents`);
    } catch (error) {
      console.error('Failed to set up sacred document tracking:', error);
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event, message, level = 'INFO', context = {}) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        event,
        level,
        message,
        context,
        process: process.pid,
        memory: process.memoryUsage().heapUsed
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.securityLog, logLine);

      // Also log to console for important events
      if (level === 'CRITICAL' || level === 'ERROR') {
        console.error(`🚨 SECURITY ${level}: ${message}`);
      } else if (level === 'WARNING') {
        console.warn(`⚠️ SECURITY WARNING: ${message}`);
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Get security status report
   */
  async getSecurityStatus() {
    try {
      const [authStatus, integrityStatus, checkpointStatus] = await Promise.all([
        this.agentAuth.cleanupExpiredSessions(),
        this.hashIntegrity.getIntegrityReport(),
        this.atomicCheckpoints.getStatus();
      ]);

      return {
        timestamp: new Date().toISOString(),
        overall: 'SECURE',
        components: {
          authentication: {
            status: 'ACTIVE',
            expiredSessions: authStatus.cleaned || 0
          },
          integrity: {
            status: integrityStatus.files?.invalid === 0 ? 'VERIFIED' : 'COMPROMISED',
            report: integrityStatus
          },
          checkpoints: {
            status: 'ACTIVE',
            details: checkpointStatus
          }
        },
        sacredDocuments: {
          count: this.sacredDocuments.length,
          tracked: true
        }
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        overall: 'ERROR',
        error: error.message
      };
    }
  }

  /**
   * Emergency security lockdown
   */
  async emergencyLockdown(reason) {
    try {
      await this.logSecurityEvent('EMERGENCY_LOCKDOWN', `Emergency lockdown initiated: ${reason}`, 'CRITICAL');

      // Revoke all active sessions
      const activeSessions = await this.agentAuth.getActiveSessions?.() || [];
      for (const session of activeSessions) {
        await this.agentAuth.revokeSession(session.sessionId);
      }

      // Create emergency checkpoint
      await this.atomicCheckpoints.createCheckpoint('Emergency lockdown checkpoint', this.sacredDocuments);

      console.log('🚨 EMERGENCY LOCKDOWN ACTIVATED');
      return { success: true, reason, timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('Emergency lockdown failed:', error);
      throw error;
    }
  }

  /**
   * Helper to check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export default SacredDocumentProtection;

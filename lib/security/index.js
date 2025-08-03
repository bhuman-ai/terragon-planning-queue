/**
 * Security System Main Entry Point
 * Orchestrates all security components for Terragon
 * 
 * Usage:
 *   import Security from './lib/security/index.js';
 *   const security = new Security();
 *   await security.initialize();
 */

import AgentAuthenticator from './agent-auth.js';
import DualHashIntegrity from './dual-hash-integrity.js';
import AtomicCheckpoints from './atomic-checkpoints.js';
import SacredDocumentProtection from './sacred-document-middleware.js';

class SecuritySystem {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.protection = new SacredDocumentProtection(projectRoot);
    this.initialized = false;
  }

  /**
   * Initialize the complete security system
   */
  async initialize() {
    if (this.initialized) {
      return { success: true, message: 'Security system already initialized' };
    }

    try {
      console.log('🔐 Initializing Terragon Security System...');
      
      const result = await this.protection.initialize();
      this.initialized = true;
      
      console.log('✅ Terragon Security System fully operational');
      return result;
    } catch (error) {
      console.error('❌ Security system initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get middleware for Express/Next.js
   */
  getMiddleware() {
    if (!this.initialized) {
      throw new Error('Security system must be initialized before using middleware');
    }
    return this.protection.createMiddleware();
  }

  /**
   * Protect sacred operation
   */
  async protectOperation(operation, options = {}) {
    if (!this.initialized) {
      throw new Error('Security system must be initialized');
    }
    return this.protection.protectSacredOperation(operation, options);
  }

  /**
   * Verify sacred document
   */
  async verifySacredDocument(filePath) {
    if (!this.initialized) {
      throw new Error('Security system must be initialized');
    }
    return this.protection.verifySacredDocument(filePath);
  }

  /**
   * Create secure checksum
   */
  async createChecksum(filePath) {
    if (!this.initialized) {
      throw new Error('Security system must be initialized');
    }
    return this.protection.secureDocumentChecksum(filePath);
  }

  /**
   * Get security status
   */
  async getStatus() {
    if (!this.initialized) {
      return { error: 'Security system not initialized' };
    }
    return this.protection.getSecurityStatus();
  }

  /**
   * Emergency lockdown
   */
  async emergencyLockdown(reason) {
    if (!this.initialized) {
      throw new Error('Security system must be initialized');
    }
    return this.protection.emergencyLockdown(reason);
  }

  /**
   * Generate agent certificate
   */
  async generateAgentCertificate(agentId, agentType = 'meta-agent') {
    if (!this.initialized) {
      throw new Error('Security system must be initialized');
    }
    return this.protection.agentAuth.generateAgentCertificate(agentId, agentType);
  }

  /**
   * Authenticate agent
   */
  async authenticateAgent(agentId, signature, data) {
    if (!this.initialized) {
      throw new Error('Security system must be initialized');
    }
    return this.protection.agentAuth.authenticateAgent(agentId, signature, data);
  }

  /**
   * Validate session
   */
  async validateSession(sessionToken) {
    if (!this.initialized) {
      throw new Error('Security system must be initialized');
    }
    return this.protection.agentAuth.validateSession(sessionToken);
  }

  /**
   * Create integrity snapshot
   */
  async createIntegritySnapshot() {
    if (!this.initialized) {
      throw new Error('Security system must be initialized');
    }
    return this.protection.hashIntegrity.createIntegritySnapshot();
  }

  /**
   * Access individual components (for advanced use)
   */
  get components() {
    if (!this.initialized) {
      throw new Error('Security system must be initialized');
    }
    return {
      agentAuth: this.protection.agentAuth,
      hashIntegrity: this.protection.hashIntegrity,
      atomicCheckpoints: this.protection.atomicCheckpoints,
      protection: this.protection
    };
  }
}

// Default export
export default SecuritySystem;

// Named exports for individual components
export {
  AgentAuthenticator,
  DualHashIntegrity,
  AtomicCheckpoints,
  SacredDocumentProtection
};
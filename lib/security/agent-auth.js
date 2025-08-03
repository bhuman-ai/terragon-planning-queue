/**
 * Agent Authentication System
 * Implements RSA-2048/Ed25519 certificate-based authentication for AI agents
 *
 * This system ensures only authorized agents can modify sacred documents
 * and provides cryptographic proof of agent identity
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

class AgentAuthenticator {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.certsDir = path.join(projectRoot, '.security', 'certificates');
    this.authDir = path.join(projectRoot, '.security', 'auth');
    this.sessionTimeout = 3600000; // 1 hour
  }

  /**
   * Initialize the authentication system
   */
  async initialize() {
    try {
      // Ensure security directories exist
      await fs.mkdir(path.join(this.projectRoot, '.security'), { recursive: true });
      await fs.mkdir(this.certsDir, { recursive: true });
      await fs.mkdir(this.authDir, { recursive: true });

      // Generate master CA certificate if it doesn't exist
      const caKeyPath = path.join(this.certsDir, 'ca-private.pem');
      const caCertPath = path.join(this.certsDir, 'ca-cert.pem');

      if (!await this.fileExists(caKeyPath) || !await this.fileExists(caCertPath)) {
        await this.generateCACertificate();
      }

      return { success: true, message: 'Agent authentication system initialized' };
    } catch (error) {
      throw new Error(`Failed to initialize agent auth: ${error.message}`);
    }
  }

  /**
   * Generate Certificate Authority (CA) for signing agent certificates
   */
  async generateCACertificate() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Create self-signed CA certificate
    const cert = this.createCertificate({
      subject: 'CN=Terragon CA,O=Terragon Security,C=US',
      issuer: 'CN=Terragon CA,O=Terragon Security,C=US',
      publicKey,
      privateKey,
      isCA: true,
      validDays: 3650 // 10 years
    });

    await fs.writeFile(path.join(this.certsDir, 'ca-private.pem'), privateKey);
    await fs.writeFile(path.join(this.certsDir, 'ca-cert.pem'), cert);

    // Store CA fingerprint for validation
    const fingerprint = crypto.createHash('sha256').update(cert).digest('hex');
    await fs.writeFile(
      path.join(this.certsDir, 'ca-fingerprint.txt'),
      fingerprint
    );
  }

  /**
   * Generate agent certificate signed by CA
   */
  async generateAgentCertificate(agentId, agentType = 'meta-agent') {
    if (!agentId || typeof agentId !== 'string') {
      throw new Error('Agent ID is required and must be a string');
    }

    // Generate Ed25519 key pair for agent
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Load CA private key for signing
    const caPrivateKey = await fs.readFile(
      path.join(this.certsDir, 'ca-private.pem'),
      'utf-8';
    );

    // Create agent certificate
    const cert = this.createCertificate({
      subject: `CN=${agentId},OU=${agentType},O=Terragon AI,C=US`,
      issuer: 'CN=Terragon CA,O=Terragon Security,C=US',
      publicKey,
      privateKey: caPrivateKey,
      isCA: false,
      validDays: 90 // 3 months
    });

    // Store agent certificate and private key
    const agentDir = path.join(this.certsDir, 'agents', agentId);
    await fs.mkdir(agentDir, { recursive: true });

    await fs.writeFile(path.join(agentDir, 'private.pem'), privateKey);
    await fs.writeFile(path.join(agentDir, 'cert.pem'), cert);

    // Create agent metadata
    const metadata = {
      agentId,
      agentType,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      fingerprint: crypto.createHash('sha256').update(cert).digest('hex'),
      permissions: this.getDefaultPermissions(agentType)
    };

    await fs.writeFile(
      path.join(agentDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    return {
      agentId,
      certificate: cert,
      fingerprint: metadata.fingerprint,
      expiresAt: metadata.expiresAt
    };
  }

  /**
   * Authenticate agent using certificate
   */
  async authenticateAgent(agentId, signature, data) {
    try {
      // Load agent certificate
      const agentDir = path.join(this.certsDir, 'agents', agentId);
      const cert = await fs.readFile(path.join(agentDir, 'cert.pem'), 'utf-8');
      const metadata = JSON.parse(
        await fs.readFile(path.join(agentDir, 'metadata.json'), 'utf-8');
      );

      // Check certificate expiration
      if (new Date() > new Date(metadata.expiresAt)) {
        throw new Error('Agent certificate has expired');
      }

      // Verify certificate chain against CA
      const caCert = await fs.readFile(
        path.join(this.certsDir, 'ca-cert.pem'),
        'utf-8';
      );

      if (!this.verifyCertificateChain(cert, caCert)) {
        throw new Error('Invalid certificate chain');
      }

      // Extract public key from certificate
      const publicKey = this.extractPublicKeyFromCert(cert);

      // Verify signature
      const verify = crypto.createVerify('SHA256');
      verify.update(data);
      const isValid = verify.verify(publicKey, signature, 'base64');

      if (!isValid) {
        throw new Error('Invalid signature');
      }

      // Create authenticated session
      const sessionToken = await this.createSession(agentId, metadata.permissions);

      return {
        authenticated: true,
        agentId,
        agentType: metadata.agentType,
        permissions: metadata.permissions,
        sessionToken,
        expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString()
      };

    } catch (error) {
      return {
        authenticated: false,
        error: error.message
      };
    }
  }

  /**
   * Create authenticated session
   */
  async createSession(agentId, permissions) {
    const sessionId = crypto.randomUUID();
    const sessionData = {
      sessionId,
      agentId,
      permissions,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString(),
      active: true
    };

    await fs.writeFile(
      path.join(this.authDir, `session-${sessionId}.json`),
      JSON.stringify(sessionData, null, 2)
    );

    return sessionId;
  }

  /**
   * Validate session token
   */
  async validateSession(sessionToken) {
    try {
      const sessionPath = path.join(this.authDir, `session-${sessionToken}.json`);
      const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf-8'));

      if (!sessionData.active) {
        return { valid: false, error: 'Session is inactive' };
      }

      if (new Date() > new Date(sessionData.expiresAt)) {
        // Clean up expired session
        await fs.unlink(sessionPath);
        return { valid: false, error: 'Session has expired' };
      }

      return {
        valid: true,
        agentId: sessionData.agentId,
        permissions: sessionData.permissions,
        expiresAt: sessionData.expiresAt
      };
    } catch (error) {
      return { valid: false, error: 'Invalid session token' };
    }
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionToken) {
    try {
      const sessionPath = path.join(this.authDir, `session-${sessionToken}.json`);
      const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf-8'));

      sessionData.active = false;
      sessionData.revokedAt = new Date().toISOString();

      await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign data with agent private key
   */
  async signData(agentId, data) {
    try {
      const privateKey = await fs.readFile(
        path.join(this.certsDir, 'agents', agentId, 'private.pem'),
        'utf-8';
      );

      const sign = crypto.createSign('SHA256');
      sign.update(data);
      const signature = sign.sign(privateKey, 'base64');

      return { signature, success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get default permissions for agent type
   */
  getDefaultPermissions(agentType) {
    const permissions = {
      'meta-agent': [
        'claude-md:read',
        'claude-md:propose-changes',
        'task:create',
        'task:monitor',
        'research:perform'
      ],
      'security-agent': [
        'claude-md:read',
        'claude-md:integrity-check',
        'security:audit',
        'certificates:manage'
      ],
      'system-agent': [
        'claude-md:read',
        'system:monitor',
        'logs:read'
      ]
    };

    return permissions[agentType] || ['claude-md:read'];
  }

  /**
   * Create certificate (simplified for demo - would use proper X.509 in production)
   */
  createCertificate({ subject, issuer, publicKey, privateKey, isCA, validDays }) {
    const cert = {
      version: 3,
      serialNumber: crypto.randomUUID(),
      subject,
      issuer,
      notBefore: new Date().toISOString(),
      notAfter: new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString(),
      publicKey,
      isCA,
      keyUsage: isCA ? ['keyCertSign', 'cRLSign'] : ['digitalSignature', 'keyEncipherment'],
      basicConstraints: isCA ? { cA: true } : { cA: false }
    };

    // Sign certificate
    const certData = JSON.stringify(cert);
    const sign = crypto.createSign('SHA256');
    sign.update(certData);
    const signature = sign.sign(privateKey, 'base64');

    return JSON.stringify({ ...cert, signature });
  }

  /**
   * Extract public key from certificate
   */
  extractPublicKeyFromCert(certPem) {
    try {
      const cert = JSON.parse(certPem);
      return cert.publicKey;
    } catch (error) {
      throw new Error('Invalid certificate format');
    }
  }

  /**
   * Verify certificate chain
   */
  verifyCertificateChain(cert, caCert) {
    try {
      const certData = JSON.parse(cert);
      const caData = JSON.parse(caCert);

      // Verify issuer matches CA subject
      if (certData.issuer !== caData.subject) {
        return false;
      }

      // Verify signature with CA public key
      const certContent = { ...certData };
      delete certContent.signature;

      const verify = crypto.createVerify('SHA256');
      verify.update(JSON.stringify(certContent));

      return verify.verify(caData.publicKey, certData.signature, 'base64');
    } catch (error) {
      return false;
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

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const sessionFiles = await fs.readdir(this.authDir);
      const cleaned = 0;

      for (const file of sessionFiles) {
        if (file.startsWith('session-') && file.endsWith('.json')) {
          const sessionPath = path.join(this.authDir, file);
          const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf-8'));

          if (new Date() > new Date(sessionData.expiresAt)) {
            await fs.unlink(sessionPath);
            cleaned++;
          }
        }
      }

      return { cleaned, message: `Cleaned up ${cleaned} expired sessions` };
    } catch (error) {
      return { error: error.message };
    }
  }
}

export default AgentAuthenticator;

// Export simplified verify functions for collaboration system
export const verifyAgentAuth = {
  generateToken: () => {
    return crypto.randomUUID() + `_${Date.now()}`;
  },

  validateToken: (token) => {
    // Simple validation - in production this would verify the actual certificate
    return token && typeof token === 'string' && token.length > 10;
  }
};

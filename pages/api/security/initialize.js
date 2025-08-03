/**
 * Security System Initialization API
 * POST /api/security/initialize
 * 
 * Initializes the Phase 2A security controls:
 * - Agent authentication system
 * - Dual-hash integrity verification
 * - Atomic checkpoint system
 * - Sacred document protection
 */

import SecuritySystem from '../../../lib/security/index.js';

let securitySystem = null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    console.log('🔐 Initializing security system via API...');

    // Initialize security system if not already done
    if (!securitySystem) {
      securitySystem = new SecuritySystem();
    }

    const result = await securitySystem.initialize();

    // Get initial security status
    const status = await securitySystem.getStatus();

    return res.status(200).json({
      success: true,
      message: 'Phase 2A security controls initialized successfully',
      result,
      status,
      components: {
        agentAuthentication: 'RSA-2048/Ed25519 certificates',
        integrityVerification: 'SHA3-256 + BLAKE3 dual hashing',
        atomicCheckpoints: 'Race condition prevention',
        sacredDocumentProtection: 'CLAUDE.md protection middleware'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Security initialization failed:', error);

    return res.status(500).json({
      success: false,
      error: 'Security initialization failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Export security system instance for use by other modules
export { securitySystem };
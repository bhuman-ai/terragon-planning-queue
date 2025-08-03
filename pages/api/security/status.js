/**
 * Security System Status API
 * GET /api/security/status
 *
 * Returns comprehensive security status including:
 * - Component status
 * - Integrity verification results
 * - Active sessions and locks
 * - Recent security events
 */

import { securitySystem } from './initialize.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    });
  }

  try {
    if (!securitySystem) {
      return res.status(503).json({
        error: 'Security system not initialized',
        message: 'Please initialize the security system first',
        initializeUrl: '/api/security/initialize'
      });
    }

    // Get comprehensive security status
    const status = await securitySystem.getStatus();

    // Get additional component details
    const { components } = securitySystem;

    const integrityReport = await components.hashIntegrity.getIntegrityReport();
    const checkpointStatus = await components.atomicCheckpoints.getStatus();

    // Get active sessions (if available)
    let activeSessions = [];
    try {
      activeSessions = await components.agentAuth.getActiveSessions?.() || [];
    } catch (error) {
      // Method might not exist, that's okay
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      overall: status.overall || 'UNKNOWN',
      components: {
        authentication: {
          status: 'ACTIVE',
          activeSessions: activeSessions.length,
          description: 'RSA-2048/Ed25519 certificate-based authentication'
        },
        integrity: {
          status: integrityReport.files?.invalid === 0 ? 'VERIFIED' : 'COMPROMISED',
          trackedFiles: integrityReport.files?.tracked || 0,
          invalidFiles: integrityReport.files?.invalid || 0,
          missingFiles: integrityReport.files?.missing || 0,
          description: 'SHA3-256 + BLAKE3 dual-hash integrity verification'
        },
        checkpoints: {
          status: 'ACTIVE',
          totalCheckpoints: checkpointStatus.checkpoints?.total || 0,
          activeTransactions: checkpointStatus.transactions?.active || 0,
          activeLocks: checkpointStatus.locks?.active || 0,
          description: 'Atomic checkpoint system for race condition prevention'
        },
        sacredDocuments: {
          status: 'PROTECTED',
          count: status.sacredDocuments?.count || 0,
          tracked: status.sacredDocuments?.tracked || false,
          description: 'Sacred document protection middleware'
        }
      },
      details: {
        integrityReport,
        checkpointStatus,
        activeSessions: activeSessions.map(session => ({
          id: session.sessionId,
          agentId: session.agentId,
          expiresAt: session.expiresAt
        }))
      },
      securityLevel: this.calculateSecurityLevel(status, integrityReport, checkpointStatus),
      recommendations: this.generateSecurityRecommendations(status, integrityReport)
    });

  } catch (error) {
    console.error('❌ Failed to get security status:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to get security status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Calculate overall security level
 */
function calculateSecurityLevel(status, integrityReport, checkpointStatus) {
  const score = 100;

  // Deduct points for integrity issues
  if (integrityReport.files?.invalid > 0) {
    score -= 50; // Major deduction for compromised files
  }

  if (integrityReport.files?.missing > 0) {
    score -= 20; // Moderate deduction for missing files
  }

  // Deduct points for system issues
  if (status.overall === 'ERROR') {
    score -= 30;
  }

  // Determine security level
  if (score >= 90) return 'MAXIMUM';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  if (score >= 30) return 'LOW';
  return 'CRITICAL';
}

/**
 * Generate security recommendations
 */
function generateSecurityRecommendations(status, integrityReport) {
  const recommendations = [];

  if (integrityReport.files?.invalid > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      action: 'INVESTIGATE_TAMPERING',
      message: 'Sacred documents have been tampered with - immediate investigation required',
      files: integrityReport.violations?.map(v => v.filePath) || []
    });
  }

  if (integrityReport.files?.missing > 0) {
    recommendations.push({
      priority: 'HIGH',
      action: 'RESTORE_MISSING_FILES',
      message: 'Some tracked files are missing - restore from backup or recreate'
    });
  }

  if (status.overall === 'ERROR') {
    recommendations.push({
      priority: 'HIGH',
      action: 'SYSTEM_MAINTENANCE',
      message: 'Security system errors detected - perform maintenance'
    });
  }

  // Always recommend regular integrity checks
  recommendations.push({
    priority: 'LOW',
    action: 'SCHEDULE_INTEGRITY_CHECK',
    message: 'Schedule regular integrity verification (recommended: daily)',
    interval: '24 hours'
  });

  return recommendations;
}

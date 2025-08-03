/**
 * Sacred Document Verification API
 * POST /api/security/verify-sacred
 * 
 * Verifies the integrity of sacred documents (especially CLAUDE.md)
 * Returns detailed verification results and security status
 */

import { securitySystem } from './initialize.js';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
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

    const { filePath } = req.body;

    // Default to CLAUDE.md if no path specified
    const targetPath = filePath || path.join(process.cwd(), 'CLAUDE.md');

    console.log(`🔍 Verifying sacred document: ${targetPath}`);

    // Verify the sacred document
    const verification = await securitySystem.verifySacredDocument(targetPath);

    // Get comprehensive integrity report
    const integrityReport = await securitySystem.components.hashIntegrity.getIntegrityReport();

    // Determine security response level
    let responseLevel = 'INFO';
    let actionRequired = false;

    if (!verification.sacred) {
      responseLevel = 'WARNING';
    } else if (!verification.verified) {
      responseLevel = 'CRITICAL';
      actionRequired = true;
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      filePath: targetPath,
      verification,
      integrityReport: {
        totalFiles: integrityReport.files?.tracked || 0,
        verifiedFiles: integrityReport.files?.verified || 0,
        invalidFiles: integrityReport.files?.invalid || 0,
        missingFiles: integrityReport.files?.missing || 0,
        violations: integrityReport.violations || []
      },
      responseLevel,
      actionRequired,
      recommendations: []
    };

    // Add specific recommendations based on verification results
    if (!verification.sacred) {
      response.recommendations.push({
        priority: 'INFO',
        action: 'FILE_NOT_SACRED',
        message: 'File is not classified as sacred - no special protection required'
      });
    } else if (!verification.verified) {
      response.recommendations.push({
        priority: 'CRITICAL',
        action: 'EMERGENCY_LOCKDOWN',
        message: 'Sacred document has been tampered with - consider emergency lockdown'
      });
      
      response.recommendations.push({
        priority: 'CRITICAL',
        action: 'RESTORE_FROM_BACKUP',
        message: 'Restore sacred document from last known good checkpoint'
      });
      
      response.recommendations.push({
        priority: 'HIGH',
        action: 'INVESTIGATE_BREACH',
        message: 'Investigate how sacred document was compromised'
      });
    } else {
      response.recommendations.push({
        priority: 'INFO',
        action: 'CONTINUE_MONITORING',
        message: 'Sacred document integrity verified - continue normal monitoring'
      });
    }

    // Set appropriate HTTP status
    let httpStatus = 200;
    if (responseLevel === 'CRITICAL') {
      httpStatus = 409; // Conflict - document compromised
    } else if (responseLevel === 'WARNING') {
      httpStatus = 202; // Accepted but with warnings
    }

    return res.status(httpStatus).json(response);

  } catch (error) {
    console.error('❌ Sacred document verification failed:', error);

    return res.status(500).json({
      success: false,
      error: 'Verification failed',
      message: error.message,
      timestamp: new Date().toISOString(),
      responseLevel: 'ERROR',
      actionRequired: true,
      recommendations: [
        {
          priority: 'HIGH',
          action: 'SYSTEM_CHECK',
          message: 'Security system malfunction - perform diagnostic check'
        }
      ]
    });
  }
}
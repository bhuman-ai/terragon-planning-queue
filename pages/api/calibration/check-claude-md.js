import fs from 'fs/promises';
import path from 'path';
import ClaudeIntegrityChecker from '../../../lib/claude-integrity.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const projectRoot = process.cwd();
    const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');

    // Check if CLAUDE.md exists
    let exists = false;
    let integrity = null;

    try {
      await fs.readFile(claudeMdPath, 'utf-8');
      exists = true;

      // Check integrity
      const checker = new ClaudeIntegrityChecker(projectRoot);
      integrity = await checker.checkIntegrity();

    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Check for drift if CLAUDE.md exists
    let driftReport = null;
    if (exists) {
      const checker = new ClaudeIntegrityChecker(projectRoot);
      driftReport = await checker.detectDrift();
    }

    res.status(200).json({
      exists,
      valid: integrity?.valid || false,
      hasIntegrityIssues: integrity && !integrity.valid,
      driftDetected: driftReport?.summary?.status === 'DRIFT_DETECTED',
      driftCount: driftReport?.summary?.totalDrifts || 0,
      lastVerified: integrity?.meta?.lastVerified,
      needsCalibration: !exists,
      needsUpdate: exists && (driftReport?.summary?.totalDrifts > 0 || !integrity?.valid)
    });

  } catch (error) {
    console.error('Check CLAUDE.md error:', error);
    res.status(500).json({
      error: 'Failed to check CLAUDE.md',
      details: error.message
    });
  }
}

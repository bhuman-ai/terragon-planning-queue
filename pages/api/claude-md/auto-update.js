/**
 * Manual Claude Auto-Update API
 * Allows manual triggering of CLAUDE.md updates for testing and on-demand updates
 */

const ClaudeAutoUpdater = require('../../../lib/claude-auto-updater');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action = 'detect', forceUpdate = false } = req.body;

  console.log(`🔧 Manual CLAUDE.md update request - Action: ${action}, Force: ${forceUpdate}`);

  try {
    const updater = new ClaudeAutoUpdater({
      projectRoot: process.cwd(),
      claudeApiKey: process.env.CLAUDE_API_KEY
    });

    if (action === 'detect') {
      // Just detect triggers without updating
      const triggers = await updater.detectUpdateTriggers();
      
      return res.status(200).json({
        message: 'Trigger detection completed',
        triggers: {
          changeCount: triggers.changes.length,
          updateRequired: triggers.updateRequired,
          priority: triggers.priority,
          changes: triggers.changes
        },
        recommendation: triggers.updateRequired 
          ? 'Update recommended - call with action=update to apply'
          : 'No update needed - CLAUDE.md is current'
      });
    }

    if (action === 'update') {
      // Detect and apply updates
      const triggers = await updater.detectUpdateTriggers();
      
      if (!triggers.updateRequired && !forceUpdate) {
        return res.status(200).json({
          message: 'No update required',
          triggers: triggers,
          updated: false
        });
      }

      // Force update if requested or if triggers detected
      if (forceUpdate) {
        triggers.updateRequired = true;
        triggers.priority = 'medium';
        if (triggers.changes.length === 0) {
          triggers.changes.push({
            type: 'MANUAL_FORCE_UPDATE',
            severity: 'MEDIUM',
            message: 'Manual force update requested',
            requiresUpdate: true
          });
        }
      }

      const updateResult = await updater.executeAutomaticUpdate(triggers);
      
      return res.status(200).json({
        message: updateResult.updated 
          ? 'CLAUDE.md updated successfully' 
          : 'Update attempted but not applied',
        triggers: triggers,
        update: updateResult,
        updated: updateResult.updated
      });
    }

    if (action === 'status') {
      // Get current auto-updater status
      const status = await getAutoUpdaterStatus();
      return res.status(200).json(status);
    }

    if (action === 'backup') {
      // Create manual backup
      const claudeMdPath = process.cwd() + '/CLAUDE.md';
      const fs = require('fs').promises;
      
      try {
        const content = await fs.readFile(claudeMdPath, 'utf-8');
        await updater.createBackup(content);
        
        return res.status(200).json({
          message: 'Backup created successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return res.status(500).json({
          message: 'Backup failed',
          error: error.message
        });
      }
    }

    return res.status(400).json({ 
      error: 'Invalid action',
      validActions: ['detect', 'update', 'status', 'backup']
    });

  } catch (error) {
    console.error('❌ Error in manual CLAUDE.md update:', error);
    
    return res.status(500).json({
      message: 'Manual update failed',
      error: error.message
    });
  }
}

/**
 * Get auto-updater status and statistics
 */
async function getAutoUpdaterStatus() {
  const fs = require('fs').promises;
  const path = require('path');
  
  const status = {
    timestamp: new Date().toISOString(),
    autoUpdaterEnabled: !!process.env.CLAUDE_API_KEY,
    lastUpdate: null,
    backupCount: 0,
    updateHistory: [],
    nextScheduledCheck: null
  };

  try {
    const metaDir = path.join(process.cwd(), '.claude');
    
    // Check for update log
    const updateLogPath = path.join(metaDir, 'update-log.json');
    try {
      const logContent = await fs.readFile(updateLogPath, 'utf-8');
      const updateLog = JSON.parse(logContent);
      
      status.updateHistory = updateLog.slice(-10); // Last 10 updates
      status.lastUpdate = updateLog.length > 0 ? updateLog[updateLog.length - 1] : null;
    } catch (error) {
      // No update log exists yet
    }

    // Count backups
    try {
      const files = await fs.readdir(metaDir);
      status.backupCount = files.filter(file => 
        file.startsWith('claude-backup-') && file.endsWith('.md')
      ).length;
    } catch (error) {
      // Meta directory might not exist yet
    }

    // Calculate next scheduled check (every 30 minutes)
    const now = new Date();
    const nextHalfHour = new Date(now);
    nextHalfHour.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
    status.nextScheduledCheck = nextHalfHour.toISOString();

  } catch (error) {
    status.error = error.message;
  }

  return status;
}
/**
 * Cron Job API - Automated CLAUDE.md Update Trigger
 * Scheduled to run every 30 minutes to detect and apply updates
 */

const ClaudeAutoUpdater = require('../../../lib/claude-auto-updater');

export default async function handler(req, res) {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  if (cronSecret !== process.env.CRON_SECRET) {
    console.log('❌ Unauthorized cron request - invalid secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('🕐 Starting automated CLAUDE.md update check...');

  try {
    const updater = new ClaudeAutoUpdater({
      projectRoot: process.cwd(),
      claudeApiKey: process.env.CLAUDE_API_KEY
    });

    // Step 1: Detect update triggers
    console.log('🔍 Detecting update triggers...');
    const triggers = await updater.detectUpdateTriggers();
    
    const result = {
      timestamp: new Date().toISOString(),
      triggers: {
        changeCount: triggers.changes.length,
        updateRequired: triggers.updateRequired,
        priority: triggers.priority,
        changes: triggers.changes.map(change => ({
          type: change.type,
          severity: change.severity,
          message: change.message,
          requiresUpdate: change.requiresUpdate
        }))
      },
      execution: {
        startTime: new Date(startTime).toISOString(),
        duration: null,
        success: false
      }
    };

    console.log(`📊 Trigger analysis: ${triggers.changes.length} changes detected, update required: ${triggers.updateRequired}`);

    // Step 2: Execute update if required
    if (triggers.updateRequired) {
      console.log(`🚀 Executing automatic update (Priority: ${triggers.priority})...`);
      
      const updateResult = await updater.executeAutomaticUpdate(triggers);
      
      result.update = updateResult;
      result.execution.success = updateResult.updated;
      
      if (updateResult.updated) {
        console.log('✅ CLAUDE.md successfully updated automatically');
        
        // Notify via Discord if high priority
        if (triggers.priority === 'high') {
          await notifyHighPriorityUpdate(updateResult, triggers);
        }
      } else {
        console.log(`ℹ️ Update not applied: ${updateResult.reason}`);
      }
    } else {
      console.log('✅ No update required - CLAUDE.md is current');
      result.execution.success = true;
    }

    // Calculate execution time
    result.execution.duration = Date.now() - startTime;
    result.execution.endTime = new Date().toISOString();

    // Return results
    res.status(200).json({
      message: triggers.updateRequired 
        ? (result.update?.updated ? 'CLAUDE.md updated successfully' : 'Update required but not applied')
        : 'No update required',
      ...result
    });

  } catch (error) {
    console.error('❌ Error in automated CLAUDE.md update:', error);
    
    const errorResult = {
      timestamp: new Date().toISOString(),
      error: error.message,
      execution: {
        startTime: new Date(startTime).toISOString(),
        duration: Date.now() - startTime,
        success: false,
        endTime: new Date().toISOString()
      }
    };

    res.status(500).json({
      message: 'Automated update failed',
      ...errorResult
    });
  }
}

/**
 * Notify about high priority updates via Discord
 */
async function notifyHighPriorityUpdate(updateResult, triggers) {
  try {
    const baseUrl = process.env.VERCEL_URL || 'http://localhost:3000';
    const notificationUrl = `${baseUrl}/api/discord-bot/notify`;
    
    const message = `🤖 **CLAUDE.md Auto-Updated** (High Priority)
    
**Changes Applied**: ${updateResult.changes} changes detected
**Updates**: ${updateResult.proposal?.updates?.length || 0} sections modified
**Priority**: ${triggers.priority}

**Key Changes**:
${triggers.changes.slice(0, 3).map(change => `• ${change.message}`).join('\n')}

The sacred document has been automatically updated to reflect current project state.`;

    const response = await fetch(notificationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        type: 'claude-update',
        priority: 'high'
      })
    });

    if (response.ok) {
      console.log('✅ Discord notification sent for high priority update');
    }
  } catch (error) {
    console.error('Failed to send Discord notification:', error.message);
  }
}
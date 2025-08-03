import { kv } from '@vercel/kv';
import { verifyAgentAuth } from '../../../../lib/security/agent-auth';
import { createCheckpoint } from '../../../../lib/security/atomic-checkpoints';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify agent authentication
    const agentAuth = req.headers['x-agent-auth'];
    if (!verifyAgentAuth.validateToken(agentAuth)) {
      return res.status(401).json({ error: 'Invalid agent authentication' });
    }

    const { sessionId, content, timestamp } = req.body;

    // Get session data
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Create version ID
    const versionId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Calculate changes from previous version
    const previousContent = session.sessionData.ideation.draftContent || '';
    const changes = calculateChanges(previousContent, content);

    // Create atomic checkpoint
    const checkpoint = await createCheckpoint({
      sessionId,
      type: 'ideation_draft',
      data: {
        content,
        versionId,
        changes,
        wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
        characterCount: content.length,
        lineCount: content.split('\n').length
      },
      metadata: {
        timestamp,
        agentAuth: `${agentAuth.substr(0, 10)}...` // Truncated for security
      }
    });

    // Update session data
    session.sessionData.ideation.draftContent = content;
    session.sessionData.ideation.versionHistory = [
      {
        id: versionId,
        content,
        timestamp,
        changes,
        checkpointId: checkpoint.id
      },
      ...(session.sessionData.ideation.versionHistory || []).slice(0, 49)
    ];
    session.lastAccessed = new Date().toISOString();

    // Save updated session
    await kv.set(`collaboration:session:${sessionId}`, session, {
      ex: 3600 * 24 // 24 hours expiry
    });

    res.status(200).json({
      versionId,
      changes,
      checkpointId: checkpoint.id,
      status: 'saved',
      stats: {
        wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
        characterCount: content.length,
        lineCount: content.split('\n').length
      }
    });

  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({
      error: 'Failed to save draft',
      details: error.message
    });
  }
}

function calculateChanges(oldContent, newContent) {
  // Simple diff calculation
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const added = 0;
  const removed = 0;
  const modified = 0;

  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      added++;
    } else if (newLine === undefined) {
      removed++;
    } else if (oldLine !== newLine) {
      modified++;
    }
  }

  return {
    added,
    removed,
    modified,
    total: added + removed + modified
  };
}

import { kv } from '@vercel/kv';
import { verifyAgentAuth } from '../../../../lib/security/agent-auth';
import { createCheckpoint } from '../../../../lib/security/atomic-checkpoints';
import { validateClaudemdContent } from '../../../../lib/claude-integrity';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify agent authentication
    const agentAuth = req.headers['x-agent-auth'] || req.headers['X-Agent-Auth'];
    if (!verifyAgentAuth.validateToken(agentAuth)) {
      return res.status(401).json({ error: 'Invalid agent authentication' });
    }

    const {
      sessionId,
      content,
      title,
      description,
      metadata = {}
    } = req.body;

    if (!sessionId || !content || !title) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, content, title'
      });
    }

    // Validate content against CLAUDE.md sacred principles
    const validation = await validateClaudemdContent(content);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Content validation failed',
        details: validation.errors
      });
    }

    // Generate draft ID
    const draftId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Create atomic checkpoint for draft creation
    const checkpoint = await createCheckpoint({
      sessionId,
      type: 'draft_creation',
      data: {
        draftId,
        content,
        title,
        description,
        metadata
      },
      metadata: {
        timestamp,
        agentAuth: `${agentAuth.substr(0, 10)}...`
      }
    });

    // Create draft data structure
    const draftData = {
      id: draftId,
      sessionId,
      title,
      description,
      content,
      metadata: {
        ...metadata,
        wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
        characterCount: content.length,
        lineCount: content.split('\n').length,
        contentHash: await hashContent(content)
      },
      version: 1,
      versionHistory: [{
        version: 1,
        timestamp,
        content,
        changes: {
          added: content.split('\n').length,
          removed: 0,
          modified: 0,
          total: content.split('\n').length
        },
        checkpointId: checkpoint.id
      }],
      status: 'draft',
      createdAt: timestamp,
      lastModified: timestamp,
      checkpointId: checkpoint.id
    };

    // Store draft in KV
    await kv.set(`collaboration:draft:${draftId}`, draftData, {
      ex: 3600 * 24 * 7 // 7 days expiry
    });

    // Update session to include this draft
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (session) {
      if (!session.sessionData.ideation.drafts) {
        session.sessionData.ideation.drafts = [];
      }
      session.sessionData.ideation.drafts.push({
        id: draftId,
        title,
        timestamp,
        status: 'draft'
      });
      session.lastAccessed = timestamp;

      await kv.set(`collaboration:session:${sessionId}`, session, {
        ex: 3600 * 24
      });
    }

    res.status(201).json({
      draftId,
      sessionId,
      title,
      version: 1,
      checkpointId: checkpoint.id,
      timestamp,
      stats: {
        wordCount: draftData.metadata.wordCount,
        characterCount: draftData.metadata.characterCount,
        lineCount: draftData.metadata.lineCount
      },
      validation: {
        isValid: validation.isValid,
        score: validation.score
      },
      status: 'created'
    });

  } catch (error) {
    console.error('Draft creation error:', error);
    res.status(500).json({
      error: 'Failed to create draft',
      details: error.message
    });
  }
}

// Hash content for integrity checking
async function hashContent(content) {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}

import { kv } from '@vercel/kv';
import { verifyAgentAuth } from '../../../../lib/security/agent-auth';
import { createCheckpoint } from '../../../../lib/security/atomic-checkpoints';
import { validateClaudemdContent } from '../../../../lib/claude-integrity';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify agent authentication
    const agentAuth = req.headers['x-agent-auth'];
    if (!verifyAgentAuth.validateToken(agentAuth)) {
      return res.status(401).json({ error: 'Invalid agent authentication' });
    }

    const { 
      draftId, 
      content, 
      title, 
      description, 
      metadata = {},
      conflictResolution = 'overwrite' // 'overwrite', 'merge', 'fail'
    } = req.body;

    if (!draftId || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields: draftId, content' 
      });
    }

    // Get existing draft
    const existingDraft = await kv.get(`collaboration:draft:${draftId}`);
    if (!existingDraft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    // Validate content against CLAUDE.md sacred principles
    const validation = await validateClaudemdContent(content);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Content validation failed',
        details: validation.errors
      });
    }

    const timestamp = new Date().toISOString();
    const newVersion = existingDraft.version + 1;

    // Calculate changes from previous version
    const changes = calculateDetailedChanges(existingDraft.content, content);
    
    // Check for conflicts (concurrent edits)
    const contentHash = await hashContent(content);
    const lastHash = existingDraft.metadata.contentHash;
    
    if (conflictResolution === 'fail' && changes.total > 0) {
      // Check if content has been modified since last save
      const expectedHash = await hashContent(existingDraft.content);
      if (lastHash !== expectedHash) {
        return res.status(409).json({
          error: 'Conflict detected',
          details: 'Draft has been modified by another process',
          conflictData: {
            currentVersion: existingDraft.version,
            lastModified: existingDraft.lastModified,
            expectedHash,
            actualHash: lastHash
          }
        });
      }
    }

    // Create atomic checkpoint for draft update
    const checkpoint = await createCheckpoint({
      sessionId: existingDraft.sessionId,
      type: 'draft_update',
      data: {
        draftId,
        previousVersion: existingDraft.version,
        newVersion,
        previousContent: existingDraft.content,
        newContent: content,
        changes,
        conflictResolution
      },
      metadata: {
        timestamp,
        agentAuth: agentAuth.substr(0, 10) + '...'
      }
    });

    // Create version history entry
    const versionEntry = {
      version: newVersion,
      timestamp,
      content,
      changes,
      checkpointId: checkpoint.id,
      title: title || existingDraft.title,
      description: description || existingDraft.description
    };

    // Update draft data
    const updatedDraft = {
      ...existingDraft,
      content,
      title: title || existingDraft.title,
      description: description || existingDraft.description,
      metadata: {
        ...existingDraft.metadata,
        ...metadata,
        wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
        characterCount: content.length,
        lineCount: content.split('\n').length,
        contentHash
      },
      version: newVersion,
      versionHistory: [
        versionEntry,
        ...existingDraft.versionHistory.slice(0, 49) // Keep last 50 versions
      ],
      lastModified: timestamp,
      checkpointId: checkpoint.id
    };

    // Store updated draft
    await kv.set(`collaboration:draft:${draftId}`, updatedDraft, {
      ex: 3600 * 24 * 7 // 7 days expiry
    });

    // Update session last accessed time
    const session = await kv.get(`collaboration:session:${existingDraft.sessionId}`);
    if (session) {
      session.lastAccessed = timestamp;
      await kv.set(`collaboration:session:${existingDraft.sessionId}`, session, {
        ex: 3600 * 24
      });
    }

    res.status(200).json({
      draftId,
      version: newVersion,
      previousVersion: existingDraft.version,
      checkpointId: checkpoint.id,
      timestamp,
      changes,
      stats: {
        wordCount: updatedDraft.metadata.wordCount,
        characterCount: updatedDraft.metadata.characterCount,
        lineCount: updatedDraft.metadata.lineCount
      },
      validation: {
        isValid: validation.isValid,
        score: validation.score
      },
      status: 'updated'
    });

  } catch (error) {
    console.error('Draft update error:', error);
    res.status(500).json({ 
      error: 'Failed to update draft',
      details: error.message 
    });
  }
}

// Calculate detailed changes between two content versions
function calculateDetailedChanges(oldContent, newContent) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  let added = 0;
  let removed = 0;
  let modified = 0;
  const addedLines = [];
  const removedLines = [];
  const modifiedLines = [];

  const maxLines = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    
    if (oldLine === undefined) {
      added++;
      addedLines.push({ line: i + 1, content: newLine });
    } else if (newLine === undefined) {
      removed++;
      removedLines.push({ line: i + 1, content: oldLine });
    } else if (oldLine !== newLine) {
      modified++;
      modifiedLines.push({ 
        line: i + 1, 
        old: oldLine, 
        new: newLine 
      });
    }
  }

  return {
    added,
    removed,
    modified,
    total: added + removed + modified,
    details: {
      addedLines: addedLines.slice(0, 20), // Limit for storage
      removedLines: removedLines.slice(0, 20),
      modifiedLines: modifiedLines.slice(0, 20)
    }
  };
}

// Hash content for integrity checking
async function hashContent(content) {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}
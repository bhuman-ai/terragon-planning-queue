import { kv } from '@vercel/kv';
import { verifyAgentAuth } from '../../../../lib/security/agent-auth';
import { createCheckpoint } from '../../../../lib/security/atomic-checkpoints';
import { validateClaudemdContent } from '../../../../lib/claude-integrity';
import { broadcastToSession } from '../sync/websocket';

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

    const {
      sessionId,
      originalContent,
      modifiedContent,
      conflicts = [],
      resolutionStrategy = 'manual', // 'manual', 'auto', 'ai-assisted'
      userResolutions = {},
      preserveSacredSections = true
    } = req.body;

    if (!sessionId || !originalContent || !modifiedContent) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, originalContent, modifiedContent'
      });
    }

    // Get session data
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const timestamp = new Date().toISOString();
    const mergeId = `merge_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Create checkpoint before merge operation
    const checkpoint = await createCheckpoint({
      sessionId,
      type: 'merge_operation',
      data: {
        mergeId,
        originalContent,
        modifiedContent,
        conflicts,
        resolutionStrategy
      },
      metadata: {
        timestamp,
        agentAuth: `${agentAuth.substr(0, 10)}...`
      }
    });

    // Detect conflicts if not provided
    let detectedConflicts = conflicts;
    if (detectedConflicts.length === 0) {
      detectedConflicts = await detectConflicts(originalContent, modifiedContent);
    }

    // Resolve conflicts based on strategy
    let mergeResult;
    switch (resolutionStrategy) {
      case 'manual':
        mergeResult = await manualResolution(originalContent, modifiedContent, detectedConflicts, userResolutions);
        break;
      case 'auto':
        mergeResult = await automaticResolution(originalContent, modifiedContent, detectedConflicts, preserveSacredSections);
        break;
      case 'ai-assisted':
        mergeResult = await aiAssistedResolution(originalContent, modifiedContent, detectedConflicts, preserveSacredSections);
        break;
      default:
        return res.status(400).json({ error: `Unknown resolution strategy: ${resolutionStrategy}` });
    }

    // Validate merged content against CLAUDE.md sacred principles
    const validation = await validateClaudemdContent(mergeResult.mergedContent);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Merged content validation failed',
        details: validation.errors,
        mergeResult
      });
    }

    // Create merge record
    const mergeRecord = {
      id: mergeId,
      sessionId,
      originalContent,
      modifiedContent,
      mergedContent: mergeResult.mergedContent,
      conflicts: detectedConflicts,
      resolvedConflicts: mergeResult.resolvedConflicts,
      unresolvedConflicts: mergeResult.unresolvedConflicts,
      resolutionStrategy,
      userResolutions,
      validation,
      checkpointId: checkpoint.id,
      createdAt: timestamp,
      status: mergeResult.unresolvedConflicts.length > 0 ? 'partial' : 'complete'
    };

    // Store merge record
    await kv.set(`collaboration:merge:${mergeId}`, mergeRecord, {
      ex: 3600 * 24 * 7 // 7 days expiry
    });

    // Update session merge state
    session.sessionData.merge = {
      ...session.sessionData.merge,
      currentMerge: mergeRecord,
      lastMergeId: mergeId,
      lastMergeTimestamp: timestamp
    };

    session.lastAccessed = timestamp;
    await kv.set(`collaboration:session:${sessionId}`, session, {
      ex: 3600 * 24
    });

    // Broadcast merge update
    await broadcastToSession(sessionId, 'merge-resolved', {
      mergeId,
      status: mergeRecord.status,
      conflicts: {
        total: detectedConflicts.length,
        resolved: mergeResult.resolvedConflicts.length,
        unresolved: mergeResult.unresolvedConflicts.length
      },
      validation: {
        isValid: validation.isValid,
        score: validation.score
      },
      timestamp
    });

    res.status(200).json({
      mergeId,
      sessionId,
      status: mergeRecord.status,
      mergedContent: mergeResult.mergedContent,
      conflicts: {
        detected: detectedConflicts.length,
        resolved: mergeResult.resolvedConflicts.length,
        unresolved: mergeResult.unresolvedConflicts.length,
        details: mergeResult.unresolvedConflicts
      },
      validation: {
        isValid: validation.isValid,
        score: validation.score,
        warnings: validation.warnings
      },
      checkpointId: checkpoint.id,
      timestamp
    });

  } catch (error) {
    console.error('Merge resolution error:', error);
    res.status(500).json({
      error: 'Failed to resolve merge conflicts',
      details: error.message
    });
  }
}

/**
 * Detect conflicts between original and modified content
 */
async function detectConflicts(originalContent, modifiedContent) {
  const conflicts = [];

  const originalLines = originalContent.split('\n');
  const modifiedLines = modifiedContent.split('\n');

  const maxLines = Math.max(originalLines.length, modifiedLines.length);

  for (let i = 0; i < maxLines; i++) {
    const originalLine = originalLines[i];
    const modifiedLine = modifiedLines[i];

    // Check for line modifications
    if (originalLine !== modifiedLine) {
      // Detect different types of conflicts
      if (originalLine === undefined) {
        conflicts.push({
          type: 'addition',
          line: i + 1,
          content: modifiedLine,
          severity: 'low'
        });
      } else if (modifiedLine === undefined) {
        conflicts.push({
          type: 'deletion',
          line: i + 1,
          content: originalLine,
          severity: 'medium'
        });
      } else {
        // Check if this is a sacred section
        const isSacred = isSacredSection(originalLine) || isSacredSection(modifiedLine);

        conflicts.push({
          type: 'modification',
          line: i + 1,
          original: originalLine,
          modified: modifiedLine,
          severity: isSacred ? 'high' : 'medium',
          sacred: isSacred
        });
      }
    }
  }

  return conflicts;
}

/**
 * Check if a line is part of a sacred section
 */
function isSacredSection(line) {
  const sacredPatterns = [
    /^##\s+\d+\.\s+Sacred/i,
    /^\*\*ABSOLUTE RULES/i,
    /^\*\*NO SIMULATIONS/i,
    /^\*\*NO FALLBACKS/i,
    /^\*\*ALWAYS REAL/i,
    /deployment target/i,
    /team account/i
  ];

  return sacredPatterns.some(pattern => pattern.test(line));
}

/**
 * Manual conflict resolution using user-provided resolutions
 */
async function manualResolution(originalContent, modifiedContent, conflicts, userResolutions) {
  const originalLines = originalContent.split('\n');
  const mergedLines = [...originalLines];

  const resolvedConflicts = [];
  const unresolvedConflicts = [];

  for (const conflict of conflicts) {
    const conflictKey = `${conflict.type}_${conflict.line}`;
    const resolution = userResolutions[conflictKey];

    if (resolution) {
      // Apply user resolution
      switch (resolution.action) {
        case 'accept_original':
          // Keep original - no action needed
          resolvedConflicts.push({ ...conflict, resolution: 'original' });
          break;
        case 'accept_modified':
          mergedLines[conflict.line - 1] = conflict.modified || conflict.content;
          resolvedConflicts.push({ ...conflict, resolution: 'modified' });
          break;
        case 'custom':
          mergedLines[conflict.line - 1] = resolution.content;
          resolvedConflicts.push({ ...conflict, resolution: 'custom', customContent: resolution.content });
          break;
        default:
          unresolvedConflicts.push(conflict);
      }
    } else {
      unresolvedConflicts.push(conflict);
    }
  }

  return {
    mergedContent: mergedLines.join('\n'),
    resolvedConflicts,
    unresolvedConflicts
  };
}

/**
 * Automatic conflict resolution with sacred section protection
 */
async function automaticResolution(originalContent, modifiedContent, conflicts, preserveSacredSections) {
  const originalLines = originalContent.split('\n');
  const mergedLines = [...originalLines];

  const resolvedConflicts = [];
  const unresolvedConflicts = [];

  for (const conflict of conflicts) {
    if (preserveSacredSections && conflict.sacred) {
      // Never auto-resolve sacred section conflicts
      unresolvedConflicts.push(conflict);
      continue;
    }

    // Apply automatic resolution rules
    switch (conflict.type) {
      case 'addition':
        // Auto-accept additions unless they conflict with sacred content
        if (!isSacredSection(conflict.content)) {
          if (conflict.line <= mergedLines.length) {
            mergedLines.splice(conflict.line - 1, 0, conflict.content);
          } else {
            mergedLines.push(conflict.content);
          }
          resolvedConflicts.push({ ...conflict, resolution: 'auto_accept' });
        } else {
          unresolvedConflicts.push(conflict);
        }
        break;

      case 'deletion':
        // Be conservative with deletions
        if (conflict.severity === 'low') {
          mergedLines.splice(conflict.line - 1, 1);
          resolvedConflicts.push({ ...conflict, resolution: 'auto_delete' });
        } else {
          unresolvedConflicts.push(conflict);
        }
        break;

      case 'modification':
        // Only auto-resolve low-severity modifications
        if (conflict.severity === 'low') {
          mergedLines[conflict.line - 1] = conflict.modified;
          resolvedConflicts.push({ ...conflict, resolution: 'auto_modify' });
        } else {
          unresolvedConflicts.push(conflict);
        }
        break;

      default:
        unresolvedConflicts.push(conflict);
    }
  }

  return {
    mergedContent: mergedLines.join('\n'),
    resolvedConflicts,
    unresolvedConflicts
  };
}

/**
 * AI-assisted conflict resolution
 */
async function aiAssistedResolution(originalContent, modifiedContent, conflicts, preserveSacredSections) {
  // For now, fall back to automatic resolution
  // This can be enhanced with Claude API integration for intelligent merging
  return await automaticResolution(originalContent, modifiedContent, conflicts, preserveSacredSections);
}

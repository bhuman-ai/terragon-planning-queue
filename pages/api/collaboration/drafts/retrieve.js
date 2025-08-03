import { kv } from '@vercel/kv';
import { verifyAgentAuth } from '../../../../lib/security/agent-auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify agent authentication
    const agentAuth = req.headers['x-agent-auth'];
    if (!verifyAgentAuth.validateToken(agentAuth)) {
      return res.status(401).json({ error: 'Invalid agent authentication' });
    }

    const { draftId, version, includeHistory } = req.query;

    if (!draftId) {
      return res.status(400).json({
        error: 'Missing required parameter: draftId'
      });
    }

    // Get draft from KV
    const draft = await kv.get(`collaboration:draft:${draftId}`);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    // If specific version requested, find it in history
    let targetContent = draft.content;
    let targetVersion = draft.version;
    let targetMetadata = draft.metadata;

    if (version && parseInt(version) !== draft.version) {
      const requestedVersion = parseInt(version);
      const versionEntry = draft.versionHistory.find(v => v.version === requestedVersion);

      if (!versionEntry) {
        return res.status(404).json({
          error: `Version ${requestedVersion} not found`,
          availableVersions: draft.versionHistory.map(v => v.version)
        });
      }

      targetContent = versionEntry.content;
      targetVersion = versionEntry.version;
      targetMetadata = {
        ...draft.metadata,
        wordCount: targetContent.split(/\s+/).filter(w => w.length > 0).length,
        characterCount: targetContent.length,
        lineCount: targetContent.split('\n').length
      };
    }

    // Prepare response data
    const responseData = {
      id: draft.id,
      sessionId: draft.sessionId,
      title: draft.title,
      description: draft.description,
      content: targetContent,
      version: targetVersion,
      metadata: targetMetadata,
      status: draft.status,
      createdAt: draft.createdAt,
      lastModified: draft.lastModified,
      stats: {
        wordCount: targetMetadata.wordCount,
        characterCount: targetMetadata.characterCount,
        lineCount: targetMetadata.lineCount,
        totalVersions: draft.versionHistory.length
      }
    };

    // Include version history if requested
    if (includeHistory === 'true') {
      responseData.versionHistory = draft.versionHistory.map(v => ({
        version: v.version,
        timestamp: v.timestamp,
        title: v.title,
        description: v.description,
        changes: v.changes,
        checkpointId: v.checkpointId
        // Note: content not included to keep response size manageable
      }));
    }

    // Update session last accessed time
    const session = await kv.get(`collaboration:session:${draft.sessionId}`);
    if (session) {
      session.lastAccessed = new Date().toISOString();
      await kv.set(`collaboration:session:${draft.sessionId}`, session, {
        ex: 3600 * 24
      });
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Draft retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve draft',
      details: error.message
    });
  }
}

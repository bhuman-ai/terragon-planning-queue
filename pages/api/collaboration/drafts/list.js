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

    const { sessionId, status, limit = 50, offset = 0 } = req.query;

    if (!sessionId) {
      return res.status(400).json({ 
        error: 'Missing required parameter: sessionId' 
      });
    }

    // Get session to verify access
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get all draft IDs from session
    const sessionDrafts = session.sessionData.ideation.drafts || [];
    
    // Fetch draft details
    const drafts = [];
    for (const sessionDraft of sessionDrafts) {
      try {
        const draft = await kv.get(`collaboration:draft:${sessionDraft.id}`);
        if (draft) {
          // Filter by status if specified
          if (!status || draft.status === status) {
            drafts.push({
              id: draft.id,
              title: draft.title,
              description: draft.description,
              version: draft.version,
              status: draft.status,
              createdAt: draft.createdAt,
              lastModified: draft.lastModified,
              stats: {
                wordCount: draft.metadata.wordCount,
                characterCount: draft.metadata.characterCount,
                lineCount: draft.metadata.lineCount,
                totalVersions: draft.versionHistory.length
              },
              previewContent: draft.content.substring(0, 200) + (draft.content.length > 200 ? '...' : '')
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to load draft ${sessionDraft.id}:`, error);
      }
    }

    // Sort by last modified (newest first)
    drafts.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedDrafts = drafts.slice(startIndex, endIndex);

    // Update session last accessed time
    session.lastAccessed = new Date().toISOString();
    await kv.set(`collaboration:session:${sessionId}`, session, {
      ex: 3600 * 24
    });

    res.status(200).json({
      drafts: paginatedDrafts,
      pagination: {
        total: drafts.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: endIndex < drafts.length
      },
      filters: {
        sessionId,
        status: status || 'all'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Draft list error:', error);
    res.status(500).json({ 
      error: 'Failed to list drafts',
      details: error.message 
    });
  }
}
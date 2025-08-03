import { kv } from '@vercel/kv';
import { verifyAgentAuth } from '../../../../lib/security/agent-auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify agent authentication
    const agentAuth = req.headers['x-agent-auth'] || req.headers['X-Agent-Auth'];
    if (!verifyAgentAuth.validateToken(agentAuth)) {
      return res.status(401).json({ error: 'Invalid agent authentication' });
    }

    const { sessionId, includeActivities = false, limit = 20 } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing required parameter: sessionId'
      });
    }

    // Get session data
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get MetaAgent data from session
    const metaAgentData = session.sessionData.metaAgent || {
      activities: [],
      lastOperation: null,
      totalOperations: 0
    };

    // Prepare status response
    const status = {
      sessionId,
      metaAgent: {
        isEnabled: true, // MetaAgent is enabled in collaboration system
        totalOperations: metaAgentData.totalOperations,
        lastOperation: metaAgentData.lastOperation,
        recentActivityCount: metaAgentData.activities.length
      },
      timestamp: new Date().toISOString()
    };

    // Include activities if requested
    if (includeActivities === 'true') {
      const limitNum = parseInt(limit);
      status.activities = metaAgentData.activities.slice(0, limitNum).map(activity => ({
        id: activity.id,
        operation: activity.operation,
        timestamp: activity.timestamp,
        success: activity.success,
        metadata: activity.metadata
      }));
    }

    // Calculate operational metrics
    const recentActivities = metaAgentData.activities.filter(a =>
      new Date(a.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const successfulOperations = metaAgentData.activities.filter(a => a.success).length;
    const failedOperations = metaAgentData.activities.filter(a => !a.success).length;

    status.metrics = {
      last24Hours: recentActivities.length,
      successRate: metaAgentData.totalOperations > 0 ?
        (successfulOperations / metaAgentData.totalOperations) * 100 : 0,
      operationBreakdown: {
        successful: successfulOperations,
        failed: failedOperations,
        total: metaAgentData.totalOperations
      },
      operationTypes: getOperationTypeBreakdown(metaAgentData.activities)
    };

    // Update session last accessed
    session.lastAccessed = new Date().toISOString();
    await kv.set(`collaboration:session:${sessionId}`, session, {
      ex: 3600 * 24
    });

    res.status(200).json(status);

  } catch (error) {
    console.error('MetaAgent status error:', error);
    res.status(500).json({
      error: 'Failed to get MetaAgent status',
      details: error.message
    });
  }
}

/**
 * Get breakdown of operation types
 */
function getOperationTypeBreakdown(activities) {
  const breakdown = {};

  activities.forEach(activity => {
    const { operation } = activity;
    if (!breakdown[operation]) {
      breakdown[operation] = {
        count: 0,
        successful: 0,
        failed: 0
      };
    }

    breakdown[operation].count++;
    if (activity.success) {
      breakdown[operation].successful++;
    } else {
      breakdown[operation].failed++;
    }
  });

  return breakdown;
}

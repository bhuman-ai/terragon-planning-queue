import { kv } from '@vercel/kv';
import { verifyAgentAuth } from '../../../../lib/security/agent-auth';
import AtomicCheckpoints from '../../../../lib/security/atomic-checkpoints';

const atomicCheckpoints = new AtomicCheckpoints();

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

    const {
      sessionId,
      checkpointId,
      status,
      limit = 20,
      offset = 0,
      includeSystemStatus = false
    } = req.query;

    let checkpoints = [];
    let systemStatus = null;

    if (checkpointId) {
      // Get specific checkpoint
      const checkpoint = await kv.get(`collaboration:checkpoint:${checkpointId}`);
      if (checkpoint) {
        checkpoints = [checkpoint];
      }
    } else if (sessionId) {
      // Get checkpoints for session
      const session = await kv.get(`collaboration:session:${sessionId}`);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const sessionCheckpoints = session.sessionData.execution.checkpoints || [];

      // Fetch full checkpoint data
      for (const cp of sessionCheckpoints) {
        const fullCheckpoint = await kv.get(`collaboration:checkpoint:${cp.id}`);
        if (fullCheckpoint && (!status || fullCheckpoint.status === status)) {
          checkpoints.push(fullCheckpoint);
        }
      }
    } else {
      return res.status(400).json({
        error: 'Either sessionId or checkpointId must be provided'
      });
    }

    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedCheckpoints = checkpoints.slice(startIndex, endIndex);

    // Prepare response data
    const responseCheckpoints = paginatedCheckpoints.map(cp => ({
      id: cp.id,
      sessionId: cp.sessionId,
      type: cp.type,
      description: cp.description,
      status: cp.status,
      createdAt: cp.createdAt,
      metadata: {
        filesBackedUp: cp.metadata.filesBackedUp,
        dataSize: cp.metadata.dataSize || 0,
        timestamp: cp.metadata.timestamp
      },
      lastExecution: cp.lastExecution || null,
      // Don't include full data to keep response manageable
      dataPreview: cp.data ? `${JSON.stringify(cp.data).substring(0, 200)}...` : null
    }));

    // Get system status if requested
    if (includeSystemStatus === 'true') {
      try {
        await atomicCheckpoints.initialize();
        systemStatus = await atomicCheckpoints.getStatus();
      } catch (statusError) {
        console.warn('Failed to get system status:', statusError);
        systemStatus = { error: 'Failed to get system status' };
      }
    }

    // Get recent executions for monitoring
    const recentExecutions = [];
    if (checkpointId) {
      // Find executions for this specific checkpoint
      try {
        const [checkpoint] = checkpoints;
        if (checkpoint && checkpoint.lastExecution) {
          const execution = await kv.get(`collaboration:execution:${checkpoint.lastExecution.id}`);
          if (execution) {
            recentExecutions.push({
              id: execution.id,
              checkpointId: execution.checkpointId,
              operation: execution.operation,
              status: execution.status,
              timestamp: execution.timestamp,
              result: execution.result,
              error: execution.error
            });
          }
        }
      } catch (execError) {
        console.warn('Failed to get execution data:', execError);
      }
    }

    // Calculate health metrics
    const healthMetrics = {
      totalCheckpoints: checkpoints.length,
      statusBreakdown: {
        created: checkpoints.filter(cp => cp.status === 'created').length,
        executed: checkpoints.filter(cp => cp.status === 'executed').length,
        failed: checkpoints.filter(cp => cp.status === 'failed').length
      },
      recentActivity: {
        last24Hours: checkpoints.filter(cp =>
          new Date(cp.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length,
        lastHour: checkpoints.filter(cp =>
          new Date(cp.createdAt) > new Date(Date.now() - 60 * 60 * 1000)
        ).length
      }
    };

    res.status(200).json({
      checkpoints: responseCheckpoints,
      recentExecutions,
      healthMetrics,
      systemStatus,
      pagination: {
        total: checkpoints.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: endIndex < checkpoints.length
      },
      filters: {
        sessionId,
        checkpointId,
        status: status || 'all'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Checkpoint monitoring error:', error);
    res.status(500).json({
      error: 'Failed to monitor checkpoints',
      details: error.message
    });
  }
}

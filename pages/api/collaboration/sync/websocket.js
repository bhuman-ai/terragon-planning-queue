/**
 * WebSocket-based real-time state synchronization for Claude.md collaboration
 *
 * This endpoint handles WebSocket connections for real-time collaboration features.
 * Note: Vercel doesn't support WebSocket directly, so this uses Server-Sent Events
 * as a fallback for real-time communication.
 */

import { kv } from '@vercel/kv';
import { verifyAgentAuth } from '../../../../lib/security/agent-auth';

// Store active connections in memory (will be lost on serverless restart)
const activeConnections = new Map();

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleSSEConnection(req, res);
  } else if (req.method === 'POST') {
    return handleStateUpdate(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle Server-Sent Events connection for real-time updates
 */
async function handleSSEConnection(req, res) {
  try {
    const { sessionId, agentAuth } = req.query;

    if (!sessionId || !agentAuth) {
      return res.status(400).json({
        error: 'Missing required parameters: sessionId, agentAuth'
      });
    }

    // Verify agent authentication
    if (!verifyAgentAuth.validateToken(agentAuth)) {
      return res.status(401).json({ error: 'Invalid agent authentication' });
    }

    // Verify session exists
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const clientInfo = {
      id: connectionId,
      sessionId,
      agentAuth: `${agentAuth.substr(0, 10)}...`,
      connectedAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      response: res
    };

    // Store connection
    activeConnections.set(connectionId, clientInfo);

    // Send initial connection event
    sendSSEMessage(res, 'connected', {
      connectionId,
      sessionId,
      timestamp: new Date().toISOString(),
      activeConnections: activeConnections.size
    });

    // Send current session state
    const currentState = await getCurrentSessionState(sessionId);
    sendSSEMessage(res, 'state-sync', currentState);

    // Set up heartbeat
    const heartbeatInterval = setInterval(() => {
      if (!activeConnections.has(connectionId)) {
        clearInterval(heartbeatInterval);
        return;
      }

      try {
        sendSSEMessage(res, 'heartbeat', {
          timestamp: new Date().toISOString(),
          connectionId
        });

        clientInfo.lastHeartbeat = new Date().toISOString();
      } catch (error) {
        console.error('Heartbeat failed:', error);
        activeConnections.delete(connectionId);
        clearInterval(heartbeatInterval);
      }
    }, 30000); // 30 seconds

    // Handle client disconnect
    req.on('close', () => {
      activeConnections.delete(connectionId);
      clearInterval(heartbeatInterval);
      console.log(`Client ${connectionId} disconnected from session ${sessionId}`);
    });

    req.on('error', (error) => {
      console.error('SSE connection error:', error);
      activeConnections.delete(connectionId);
      clearInterval(heartbeatInterval);
    });

  } catch (error) {
    console.error('SSE connection setup error:', error);
    res.status(500).json({
      error: 'Failed to establish real-time connection',
      details: error.message
    });
  }
}

/**
 * Handle state updates and broadcast to connected clients
 */
async function handleStateUpdate(req, res) {
  try {
    // Verify agent authentication
    const agentAuth = req.headers['x-agent-auth'] || req.headers['X-Agent-Auth'];
    if (!verifyAgentAuth.validateToken(agentAuth)) {
      return res.status(401).json({ error: 'Invalid agent authentication' });
    }

    const {
      sessionId,
      eventType,
      data,
      targetConnectionId = null,
      excludeConnectionId = null
    } = req.body;

    if (!sessionId || !eventType || !data) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, eventType, data'
      });
    }

    // Verify session exists
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update session state based on event type
    await updateSessionState(sessionId, eventType, data);

    // Broadcast to connected clients
    const broadcastResult = await broadcastToSession(sessionId, eventType, data, {
      targetConnectionId,
      excludeConnectionId
    });

    res.status(200).json({
      sessionId,
      eventType,
      timestamp: new Date().toISOString(),
      broadcastResult
    });

  } catch (error) {
    console.error('State update error:', error);
    res.status(500).json({
      error: 'Failed to update state',
      details: error.message
    });
  }
}

/**
 * Send Server-Sent Event message
 */
function sendSSEMessage(res, eventType, data) {
  const message = {
    event: eventType,
    data,
    timestamp: new Date().toISOString()
  };

  res.write(`event: ${eventType}\n`);
  res.write(`data: ${JSON.stringify(message)}\n\n`);
}

/**
 * Get current session state for synchronization
 */
async function getCurrentSessionState(sessionId) {
  try {
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) {
      throw new Error('Session not found');
    }

    return {
      sessionId,
      workflowProgress: session.workflowProgress,
      ideation: {
        draftContent: session.sessionData.ideation.draftContent,
        currentVersion: session.sessionData.ideation.versionHistory?.[0]?.version || 0,
        lastModified: session.sessionData.ideation.versionHistory?.[0]?.timestamp
      },
      orchestration: {
        taskCount: session.sessionData.orchestration.workflowSteps?.length || 0,
        executionStatus: session.sessionData.orchestration.executionStatus
      },
      execution: {
        activeAgents: session.sessionData.execution.activeAgents || [],
        checkpointCount: session.sessionData.execution.checkpoints?.length || 0
      },
      lastAccessed: session.lastAccessed
    };
  } catch (error) {
    console.error('Failed to get session state:', error);
    return { error: error.message };
  }
}

/**
 * Update session state based on event type
 */
async function updateSessionState(sessionId, eventType, data) {
  const session = await kv.get(`collaboration:session:${sessionId}`);
  if (!session) {
    throw new Error('Session not found');
  }

  const timestamp = new Date().toISOString();

  switch (eventType) {
    case 'draft-updated':
      session.sessionData.ideation.draftContent = data.content;
      session.sessionData.ideation.lastModified = timestamp;
      break;

    case 'workflow-progress':
      session.workflowProgress = { ...session.workflowProgress, ...data.progress };
      break;

    case 'task-created':
      if (!session.sessionData.orchestration.workflowSteps) {
        session.sessionData.orchestration.workflowSteps = [];
      }
      session.sessionData.orchestration.workflowSteps.push(data.task);
      break;

    case 'checkpoint-created':
      if (!session.sessionData.execution.checkpoints) {
        session.sessionData.execution.checkpoints = [];
      }
      session.sessionData.execution.checkpoints.unshift(data.checkpoint);
      break;

    case 'agent-status':
      session.sessionData.execution.activeAgents = data.agents;
      break;
  }

  session.lastAccessed = timestamp;
  await kv.set(`collaboration:session:${sessionId}`, session, {
    ex: 3600 * 24
  });
}

/**
 * Broadcast event to all connected clients in a session
 */
async function broadcastToSession(sessionId, eventType, data, options = {}) {
  const { targetConnectionId, excludeConnectionId } = options;

  const successCount = 0;
  const errorCount = 0;
  const errors = [];

  for (const [connectionId, clientInfo] of activeConnections.entries()) {
    // Filter by session
    if (clientInfo.sessionId !== sessionId) {
      continue;
    }

    // Apply targeting/exclusion
    if (targetConnectionId && connectionId !== targetConnectionId) {
      continue;
    }
    if (excludeConnectionId && connectionId === excludeConnectionId) {
      continue;
    }

    try {
      sendSSEMessage(clientInfo.response, eventType, data);
      successCount++;
    } catch (error) {
      errorCount++;
      errors.push({ connectionId, error: error.message });
      // Remove failed connection
      activeConnections.delete(connectionId);
    }
  }

  return {
    successCount,
    errorCount,
    totalConnections: successCount + errorCount,
    errors: errors.slice(0, 5) // Limit error details
  };
}

// Export connection management functions for other APIs
export { activeConnections, broadcastToSession, sendSSEMessage };

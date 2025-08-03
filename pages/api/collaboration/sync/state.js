import { kv } from '@vercel/kv';
import { verifyAgentAuth } from '../../../../lib/security/agent-auth';
import { broadcastToSession } from './websocket';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleGetState(req, res);
  } else if (req.method === 'POST') {
    return handleUpdateState(req, res);
  } else if (req.method === 'PUT') {
    return handleSyncState(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Get current state for a session or specific component
 */
async function handleGetState(req, res) {
  try {
    // Verify agent authentication
    const agentAuth = req.headers['x-agent-auth'] || req.headers['X-Agent-Auth'];
    if (!verifyAgentAuth.validateToken(agentAuth)) {
      return res.status(401).json({ error: 'Invalid agent authentication' });
    }

    const { sessionId, component = 'all', includeHistory = false } = req.query;

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

    // Build state response based on requested component
    const state = {
      sessionId,
      timestamp: new Date().toISOString(),
      lastAccessed: session.lastAccessed,
      workflowProgress: session.workflowProgress
    };

    if (component === 'all' || component === 'ideation') {
      state.ideation = {
        draftContent: session.sessionData.ideation.draftContent,
        currentVersion: session.sessionData.ideation.versionHistory?.[0]?.version || 0,
        lastModified: session.sessionData.ideation.versionHistory?.[0]?.timestamp,
        chatHistory: includeHistory === 'true' ?
          session.sessionData.ideation.chatHistory :
          session.sessionData.ideation.chatHistory?.slice(-5) || [],
        versionCount: session.sessionData.ideation.versionHistory?.length || 0
      };
    }

    if (component === 'all' || component === 'orchestration') {
      state.orchestration = {
        taskDocument: session.sessionData.orchestration.taskDocument,
        workflowSteps: session.sessionData.orchestration.workflowSteps || [],
        executionStatus: session.sessionData.orchestration.executionStatus || {},
        dependencyCount: session.sessionData.orchestration.dependencies?.size || 0
      };
    }

    if (component === 'all' || component === 'execution') {
      state.execution = {
        checkpointDocument: session.sessionData.execution.checkpointDocument,
        activeAgents: session.sessionData.execution.activeAgents || [],
        checkpoints: session.sessionData.execution.checkpoints?.slice(0, 10) || [],
        logs: includeHistory === 'true' ?
          session.sessionData.execution.logs :
          session.sessionData.execution.logs?.slice(-20) || [],
        metrics: session.sessionData.execution.metrics || {}
      };
    }

    if (component === 'all' || component === 'merge') {
      state.merge = {
        originalContent: session.sessionData.merge.originalContent,
        modifiedContent: session.sessionData.merge.modifiedContent,
        mergedContent: session.sessionData.merge.mergedContent,
        conflicts: session.sessionData.merge.conflicts || [],
        validationStatus: session.sessionData.merge.validationStatus || {}
      };
    }

    // Update last accessed
    session.lastAccessed = new Date().toISOString();
    await kv.set(`collaboration:session:${sessionId}`, session, {
      ex: 3600 * 24
    });

    res.status(200).json(state);

  } catch (error) {
    console.error('Get state error:', error);
    res.status(500).json({
      error: 'Failed to get state',
      details: error.message
    });
  }
}

/**
 * Update state for a specific component
 */
async function handleUpdateState(req, res) {
  try {
    // Verify agent authentication
    const agentAuth = req.headers['x-agent-auth'] || req.headers['X-Agent-Auth'];
    if (!verifyAgentAuth.validateToken(agentAuth)) {
      return res.status(401).json({ error: 'Invalid agent authentication' });
    }

    const {
      sessionId,
      component,
      data,
      broadcast = true,
      conflictResolution = 'overwrite' // 'overwrite', 'merge', 'fail'
    } = req.body;

    if (!sessionId || !component || !data) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, component, data'
      });
    }

    // Get session data
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const timestamp = new Date().toISOString();
    let updateResult = { success: true, conflicts: [] };

    // Apply updates based on component
    switch (component) {
      case 'ideation':
        updateResult = await updateIdeationState(session, data, conflictResolution);
        break;
      case 'orchestration':
        updateResult = await updateOrchestrationState(session, data, conflictResolution);
        break;
      case 'execution':
        updateResult = await updateExecutionState(session, data, conflictResolution);
        break;
      case 'merge':
        updateResult = await updateMergeState(session, data, conflictResolution);
        break;
      case 'workflow':
        updateResult = await updateWorkflowProgress(session, data);
        break;
      default:
        return res.status(400).json({ error: `Unknown component: ${component}` });
    }

    if (!updateResult.success) {
      return res.status(409).json({
        error: 'State update failed due to conflicts',
        conflicts: updateResult.conflicts
      });
    }

    // Save updated session
    session.lastAccessed = timestamp;
    await kv.set(`collaboration:session:${sessionId}`, session, {
      ex: 3600 * 24
    });

    // Broadcast update to connected clients
    let broadcastResult = null;
    if (broadcast) {
      try {
        broadcastResult = await broadcastToSession(sessionId, `${component}-updated`, {
          component,
          data,
          timestamp,
          conflicts: updateResult.conflicts
        });
      } catch (broadcastError) {
        console.warn('Broadcast failed:', broadcastError);
      }
    }

    res.status(200).json({
      sessionId,
      component,
      timestamp,
      updateResult,
      broadcastResult,
      status: 'updated'
    });

  } catch (error) {
    console.error('Update state error:', error);
    res.status(500).json({
      error: 'Failed to update state',
      details: error.message
    });
  }
}

/**
 * Synchronize state between multiple clients
 */
async function handleSyncState(req, res) {
  try {
    // Verify agent authentication
    const agentAuth = req.headers['x-agent-auth'] || req.headers['X-Agent-Auth'];
    if (!verifyAgentAuth.validateToken(agentAuth)) {
      return res.status(401).json({ error: 'Invalid agent authentication' });
    }

    const { sessionId, clientState, force = false } = req.body;

    if (!sessionId || !clientState) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, clientState'
      });
    }

    // Get current server state
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const timestamp = new Date().toISOString();
    const serverState = await getCurrentSessionState(session);

    // Compare client and server states
    const syncResult = await performStateSynchronization(
      clientState,
      serverState,
      force
    );

    // Apply synchronized state if there were changes
    if (syncResult.hasChanges) {
      await applyStateChanges(session, syncResult.mergedState);

      // Save updated session
      session.lastAccessed = timestamp;
      await kv.set(`collaboration:session:${sessionId}`, session, {
        ex: 3600 * 24
      });

      // Broadcast sync update
      await broadcastToSession(sessionId, 'state-synchronized', {
        timestamp,
        conflicts: syncResult.conflicts,
        changes: syncResult.changes
      });
    }

    res.status(200).json({
      sessionId,
      timestamp,
      syncResult,
      serverState: syncResult.mergedState
    });

  } catch (error) {
    console.error('Sync state error:', error);
    res.status(500).json({
      error: 'Failed to synchronize state',
      details: error.message
    });
  }
}

// Component-specific update functions
async function updateIdeationState(session, data, _conflictResolution) {
  const conflicts = [];

  if (data.draftContent !== undefined) {
    // Check for conflicts if not overwriting
    if (conflictResolution === 'fail' &&
        session.sessionData.ideation.draftContent &&
        session.sessionData.ideation.draftContent !== data.expectedPreviousContent) {
      conflicts.push({
        field: 'draftContent',
        reason: 'Content has been modified by another client'
      });
    }

    if (conflicts.length === 0 || conflictResolution === 'overwrite') {
      session.sessionData.ideation.draftContent = data.draftContent;
    }
  }

  if (data.chatHistory) {
    session.sessionData.ideation.chatHistory = data.chatHistory;
  }

  return { success: conflicts.length === 0, conflicts };
}

async function updateOrchestrationState(session, data, _conflictResolution) {
  const conflicts = [];

  if (data.taskDocument !== undefined) {
    session.sessionData.orchestration.taskDocument = data.taskDocument;
  }

  if (data.workflowSteps) {
    session.sessionData.orchestration.workflowSteps = data.workflowSteps;
  }

  if (data.executionStatus) {
    session.sessionData.orchestration.executionStatus = {
      ...session.sessionData.orchestration.executionStatus,
      ...data.executionStatus
    };
  }

  return { success: true, conflicts };
}

async function updateExecutionState(session, data, _conflictResolution) {
  const conflicts = [];

  if (data.activeAgents) {
    session.sessionData.execution.activeAgents = data.activeAgents;
  }

  if (data.logs) {
    session.sessionData.execution.logs = [
      ...data.logs,
      ...(session.sessionData.execution.logs || [])
    ].slice(0, 1000); // Keep last 1000 logs
  }

  if (data.metrics) {
    session.sessionData.execution.metrics = {
      ...session.sessionData.execution.metrics,
      ...data.metrics
    };
  }

  return { success: true, conflicts };
}

async function updateMergeState(session, data, _conflictResolution) {
  const conflicts = [];

  Object.keys(data).forEach(key => {
    if (['originalContent', 'modifiedContent', 'mergedContent', 'conflicts', 'validationStatus'].includes(key)) {
      session.sessionData.merge[key] = data[key];
    }
  });

  return { success: true, conflicts };
}

async function updateWorkflowProgress(session, data) {
  session.workflowProgress = {
    ...session.workflowProgress,
    ...data
  };

  return { success: true, conflicts: [] };
}

// Helper functions
async function getCurrentSessionState(session) {
  return {
    ideation: session.sessionData.ideation,
    orchestration: session.sessionData.orchestration,
    execution: session.sessionData.execution,
    merge: session.sessionData.merge,
    workflowProgress: session.workflowProgress
  };
}

async function performStateSynchronization(clientState, serverState, _force) {
  const conflicts = [];
  const changes = [];
  let hasChanges = false;

  // Simple implementation - can be enhanced with operational transforms
  const mergedState = { ...serverState };

  // Compare timestamps and merge changes
  Object.keys(clientState).forEach(component => {
    if (clientState[component] && serverState[component]) {
      const clientTimestamp = clientState[component].lastModified;
      const serverTimestamp = serverState[component].lastModified;

      if (!serverTimestamp || (clientTimestamp && clientTimestamp > serverTimestamp)) {
        mergedState[component] = { ...serverState[component], ...clientState[component] };
        changes.push({ component, action: 'updated_from_client' });
        hasChanges = true;
      }
    }
  });

  return {
    hasChanges,
    conflicts,
    changes,
    mergedState
  };
}

async function applyStateChanges(session, mergedState) {
  session.sessionData = {
    ideation: mergedState.ideation || session.sessionData.ideation,
    orchestration: mergedState.orchestration || session.sessionData.orchestration,
    execution: mergedState.execution || session.sessionData.execution,
    merge: mergedState.merge || session.sessionData.merge
  };

  session.workflowProgress = mergedState.workflowProgress || session.workflowProgress;
}

import { kv } from '@vercel/kv';
import { verifyAgentAuth } from '../../../../lib/security/agent-auth';
import { broadcastToSession } from '../sync/websocket';
import MetaAgent from '../../../../lib/meta-agent';

// Initialize MetaAgent with collaboration support
const metaAgent = new MetaAgent({
  enabled: true,
  claudeApiKey: process.env.CLAUDE_API_KEY,
  perplexityApiKey: process.env.PERPLEXITY_API_KEY,
  debugMode: process.env.NODE_ENV === 'development'
});

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
      operation, 
      message, 
      context = {},
      options = {} 
    } = req.body;

    if (!sessionId || !operation) {
      return res.status(400).json({ 
        error: 'Missing required fields: sessionId, operation' 
      });
    }

    // Get session data
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const timestamp = new Date().toISOString();
    let result = null;

    // Execute MetaAgent operation based on type
    switch (operation) {
      case 'process':
        result = await processMessage(sessionId, message, context, options);
        break;
      case 'gather-requirements':
        result = await gatherRequirements(sessionId, message, context);
        break;
      case 'research':
        result = await conductResearch(sessionId, message, options);
        break;
      case 'decompose-task':
        result = await decomposeTask(sessionId, message, context);
        break;
      case 'process-full-task':
        result = await processFullTask(sessionId, message, options);
        break;
      default:
        return res.status(400).json({ error: `Unknown operation: ${operation}` });
    }

    // Update session with MetaAgent activity
    await updateSessionActivity(sessionId, operation, result, timestamp);

    // Broadcast update to connected clients
    await broadcastToSession(sessionId, 'meta-agent-update', {
      operation,
      result,
      timestamp
    });

    res.status(200).json({
      sessionId,
      operation,
      result,
      timestamp,
      status: 'completed'
    });

  } catch (error) {
    console.error('MetaAgent integration error:', error);
    res.status(500).json({ 
      error: 'Failed to execute MetaAgent operation',
      details: error.message 
    });
  }
}

/**
 * Process message through MetaAgent
 */
async function processMessage(sessionId, message, context, options) {
  try {
    const processed = await metaAgent.process(message, {
      ...options,
      sessionId,
      collaborationContext: context
    });

    return {
      operation: 'process',
      success: true,
      originalMessage: message,
      processedMessage: processed.processedMessage,
      metadata: processed.metadata,
      enhanced: processed.metadata.enhanced || false
    };
  } catch (error) {
    return {
      operation: 'process',
      success: false,
      error: error.message,
      originalMessage: message
    };
  }
}

/**
 * Gather requirements using MetaAgent
 */
async function gatherRequirements(sessionId, message, context) {
  try {
    const requirements = await metaAgent.gatherRequirements(message, {
      ...context,
      sessionId
    });

    return {
      operation: 'gather-requirements',
      success: true,
      message,
      requirements,
      hasRequirements: !!requirements
    };
  } catch (error) {
    return {
      operation: 'gather-requirements',
      success: false,
      error: error.message,
      message
    };
  }
}

/**
 * Conduct research using MetaAgent
 */
async function conductResearch(sessionId, query, options) {
  try {
    const research = await metaAgent.research(query, {
      ...options,
      sessionId
    });

    return {
      operation: 'research',
      success: true,
      query,
      research,
      hasResults: !!research
    };
  } catch (error) {
    return {
      operation: 'research',
      success: false,
      error: error.message,
      query
    };
  }
}

/**
 * Decompose task using MetaAgent
 */
async function decomposeTask(sessionId, taskSpec, context) {
  try {
    // Enhanced context with session data
    const session = await kv.get(`collaboration:session:${sessionId}`);
    const enhancedContext = {
      ...context,
      sessionData: session?.sessionData,
      userSettings: session?.userSettings,
      githubConfig: session?.githubConfig
    };

    const decomposition = await metaAgent.decomposeTask(
      taskSpec, 
      context.requirements || {}, 
      enhancedContext
    );

    return {
      operation: 'decompose-task',
      success: true,
      taskSpec,
      decomposition,
      microTaskCount: decomposition.microTasks?.length || 0,
      estimatedTime: decomposition.totalTime,
      criticalPath: decomposition.criticalPath
    };
  } catch (error) {
    return {
      operation: 'decompose-task',
      success: false,
      error: error.message,
      taskSpec
    };
  }
}

/**
 * Process full task through MetaAgent pipeline
 */
async function processFullTask(sessionId, message, options) {
  try {
    const result = await metaAgent.processTaskRequest(message, {
      ...options,
      sessionId
    });

    return {
      operation: 'process-full-task',
      success: result.success,
      message,
      classification: result.classification,
      requirements: result.requirements,
      research: result.research,
      decomposition: result.decomposition,
      task: result.task,
      error: result.error
    };
  } catch (error) {
    return {
      operation: 'process-full-task',
      success: false,
      error: error.message,
      message
    };
  }
}

/**
 * Update session with MetaAgent activity
 */
async function updateSessionActivity(sessionId, operation, result, timestamp) {
  try {
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) return;

    // Initialize MetaAgent activity log if needed
    if (!session.sessionData.metaAgent) {
      session.sessionData.metaAgent = {
        activities: [],
        lastOperation: null,
        totalOperations: 0
      };
    }

    // Add activity
    const activity = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      operation,
      timestamp,
      success: result.success,
      metadata: {
        hasRequirements: result.hasRequirements,
        hasResearch: result.hasResults,
        microTaskCount: result.microTaskCount,
        enhanced: result.enhanced
      }
    };

    session.sessionData.metaAgent.activities.unshift(activity);
    session.sessionData.metaAgent.activities = 
      session.sessionData.metaAgent.activities.slice(0, 50); // Keep last 50
    
    session.sessionData.metaAgent.lastOperation = {
      operation,
      timestamp,
      success: result.success
    };
    
    session.sessionData.metaAgent.totalOperations++;
    session.lastAccessed = timestamp;

    await kv.set(`collaboration:session:${sessionId}`, session, {
      ex: 3600 * 24
    });
  } catch (error) {
    console.error('Failed to update session activity:', error);
  }
}
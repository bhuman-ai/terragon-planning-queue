import { kv } from '@vercel/kv';
import { verifyAgentAuth } from '../../../../lib/security/agent-auth';
import AtomicCheckpoints from '../../../../lib/security/atomic-checkpoints';

const atomicCheckpoints = new AtomicCheckpoints();

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
      type, 
      description, 
      data, 
      filePaths = [],
      metadata = {} 
    } = req.body;

    if (!sessionId || !type || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields: sessionId, type, description' 
      });
    }

    // Verify session exists
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Initialize atomic checkpoint system if needed
    await atomicCheckpoints.initialize();

    // Create checkpoint using atomic system
    const checkpointResult = await atomicCheckpoints.createCheckpoint(
      `${type}: ${description}`,
      filePaths
    );

    const checkpointId = checkpointResult.checkpointId;
    const timestamp = new Date().toISOString();

    // Create collaboration checkpoint metadata
    const checkpointData = {
      id: checkpointId,
      sessionId,
      type,
      description,
      data,
      filePaths,
      metadata: {
        ...metadata,
        timestamp,
        agentAuth: agentAuth.substr(0, 10) + '...',
        filesBackedUp: checkpointResult.filesBackedUp
      },
      status: 'created',
      createdAt: timestamp
    };

    // Store checkpoint in KV for quick access
    await kv.set(`collaboration:checkpoint:${checkpointId}`, checkpointData, {
      ex: 3600 * 24 * 7 // 7 days expiry
    });

    // Update session with checkpoint reference
    if (!session.sessionData.execution.checkpoints) {
      session.sessionData.execution.checkpoints = [];
    }
    session.sessionData.execution.checkpoints.unshift({
      id: checkpointId,
      type,
      description,
      timestamp,
      status: 'created'
    });
    
    // Keep only last 50 checkpoints in session
    session.sessionData.execution.checkpoints = 
      session.sessionData.execution.checkpoints.slice(0, 50);
      
    session.lastAccessed = timestamp;
    
    await kv.set(`collaboration:session:${sessionId}`, session, {
      ex: 3600 * 24
    });

    res.status(201).json({
      checkpointId,
      sessionId,
      type,
      description,
      timestamp,
      status: 'created',
      metadata: {
        filesBackedUp: checkpointResult.filesBackedUp,
        dataSize: JSON.stringify(data).length
      }
    });

  } catch (error) {
    console.error('Checkpoint creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create checkpoint',
      details: error.message 
    });
  }
}
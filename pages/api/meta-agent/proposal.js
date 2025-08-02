/**
 * Meta-Agent Proposal Management API
 * Handles proposal creation, approval, rejection, and modifications
 */

const MetaAgent = require('../../../lib/meta-agent/index.js');

// Initialize MetaAgent
const metaAgent = new MetaAgent({
  claudeApiKey: process.env.CLAUDE_API_KEY,
  perplexityApiKey: process.env.PERPLEXITY_API_KEY,
  enabled: true,
  workingDir: process.cwd()
});

// In-memory proposal storage (in production, use Redis or database)
const proposals = new Map();

export default async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        return await handleProposal(req, res);
      case 'GET':
        return await getProposal(req, res);
      case 'PUT':
        return await updateProposal(req, res);
      case 'DELETE':
        return await deleteProposal(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Proposal API error:', error);
    res.status(500).json({
      success: false,
      error: 'Proposal processing failed',
      details: error.message
    });
  }
}

/**
 * Create a new proposal from user request
 */
async function handleProposal(req, res) {
  const { action, message, context, requirements, proposalId, modifications } = req.body;

  switch (action) {
    case 'create':
      return await createProposal(req, res, message, context);
    
    case 'approve':
      return await approveProposal(req, res, proposalId);
    
    case 'reject':
      return await rejectProposal(req, res, proposalId);
    
    case 'modify':
      return await modifyProposal(req, res, proposalId, modifications);
    
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

/**
 * Create a comprehensive proposal
 */
async function createProposal(req, res, message, context = {}) {
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  console.log('🤖 Creating Meta-Agent proposal for:', message);

  // Step 1: Classify the request
  const classification = await metaAgent.requestClassifier.classify(message);
  console.log('📊 Classification:', classification);

  if (classification.type !== 'ACTION_REQUEST') {
    return res.status(400).json({
      success: false,
      reason: 'Not an action request - no proposal needed',
      classification
    });
  }

  // Step 2: Gather requirements
  console.log('❓ Gathering requirements...');
  const requirements = await metaAgent.gatherRequirements(message, context);

  // Step 3: Conduct research
  console.log('🔍 Conducting research...');
  let research = null;
  if (metaAgent.researchAgent && metaAgent.researchAgent.enabled) {
    research = await metaAgent.research(`best practices for ${message}`);
  }

  // Step 4: Get codebase context
  const codebaseContext = await metaAgent.contextEnhancer.gatherContext(classification);

  // Step 5: Create task specification
  const taskSpec = {
    title: metaAgent.extractTitle(message),
    description: message,
    requirements: requirements?.questions || [],
    research
  };

  // Step 6: Decompose into micro-tasks with codebase context
  console.log('🔧 Decomposing into micro-tasks...');
  const decomposition = await metaAgent.decomposeTask(
    taskSpec, 
    requirements, 
    codebaseContext.context || {}
  );

  // Step 7: Create comprehensive proposal
  const proposalId = `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const proposal = {
    id: proposalId,
    taskTitle: taskSpec.title,
    originalMessage: message,
    classification,
    requirements,
    research,
    decomposition,
    codebaseContext: codebaseContext.context,
    totalTime: decomposition?.totalTime || 0,
    criticalPath: decomposition?.criticalPath || 0,
    createdAt: new Date().toISOString(),
    status: 'pending_approval',
    userContext: context
  };

  // Store proposal
  proposals.set(proposalId, proposal);

  console.log('✅ Proposal created:', proposalId);

  res.status(200).json({
    success: true,
    proposalId,
    proposal: {
      id: proposalId,
      taskTitle: proposal.taskTitle,
      requirements: proposal.requirements,
      research: proposal.research,
      decomposition: proposal.decomposition,
      totalTime: proposal.totalTime,
      criticalPath: proposal.criticalPath,
      status: proposal.status
    }
  });
}

/**
 * Approve a proposal and execute it
 */
async function approveProposal(req, res, proposalId) {
  if (!proposalId) {
    return res.status(400).json({ error: 'Proposal ID is required' });
  }

  const proposal = proposals.get(proposalId);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  console.log('✅ Approving proposal:', proposalId);

  // Update proposal status
  proposal.status = 'approved';
  proposal.approvedAt = new Date().toISOString();
  proposals.set(proposalId, proposal);

  // Create the actual task (this would trigger Terragon)
  const task = await metaAgent.createTask({
    ...proposal,
    decomposition: proposal.decomposition?.microTasks || []
  });

  console.log('🚀 Task created and ready for execution');

  res.status(200).json({
    success: true,
    message: 'Proposal approved and task created',
    proposalId,
    task,
    nextStep: 'execute_terragon'
  });
}

/**
 * Reject a proposal
 */
async function rejectProposal(req, res, proposalId) {
  if (!proposalId) {
    return res.status(400).json({ error: 'Proposal ID is required' });
  }

  const proposal = proposals.get(proposalId);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  console.log('❌ Rejecting proposal:', proposalId);

  // Update proposal status
  proposal.status = 'rejected';
  proposal.rejectedAt = new Date().toISOString();
  proposals.set(proposalId, proposal);

  res.status(200).json({
    success: true,
    message: 'Proposal rejected',
    proposalId
  });
}

/**
 * Modify a proposal based on user feedback
 */
async function modifyProposal(req, res, proposalId, modifications) {
  if (!proposalId) {
    return res.status(400).json({ error: 'Proposal ID is required' });
  }

  if (!modifications) {
    return res.status(400).json({ error: 'Modifications are required' });
  }

  const proposal = proposals.get(proposalId);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  console.log('✏️ Modifying proposal:', proposalId, 'with:', modifications);

  try {
    // Re-analyze with modifications
    const modifiedMessage = `${proposal.originalMessage}\n\nUser Modifications: ${modifications}`;
    
    // Re-decompose with modifications
    const newDecomposition = await metaAgent.decomposeTask(
      {
        title: proposal.taskTitle,
        description: modifiedMessage,
        requirements: proposal.requirements,
        research: proposal.research
      },
      proposal.requirements,
      proposal.codebaseContext
    );

    // Update proposal
    proposal.decomposition = newDecomposition;
    proposal.totalTime = newDecomposition?.totalTime || 0;
    proposal.criticalPath = newDecomposition?.criticalPath || 0;
    proposal.modifications = modifications;
    proposal.modifiedAt = new Date().toISOString();
    proposal.status = 'modified_pending_approval';

    proposals.set(proposalId, proposal);

    res.status(200).json({
      success: true,
      message: 'Proposal modified successfully',
      proposalId,
      proposal: {
        id: proposalId,
        taskTitle: proposal.taskTitle,
        requirements: proposal.requirements,
        research: proposal.research,
        decomposition: proposal.decomposition,
        totalTime: proposal.totalTime,
        criticalPath: proposal.criticalPath,
        modifications: proposal.modifications,
        status: proposal.status
      }
    });

  } catch (error) {
    console.error('Modification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to modify proposal',
      details: error.message
    });
  }
}

/**
 * Get a proposal by ID
 */
async function getProposal(req, res) {
  const { proposalId } = req.query;

  if (!proposalId) {
    return res.status(400).json({ error: 'Proposal ID is required' });
  }

  const proposal = proposals.get(proposalId);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  res.status(200).json({
    success: true,
    proposal: {
      id: proposal.id,
      taskTitle: proposal.taskTitle,
      requirements: proposal.requirements,
      research: proposal.research,
      decomposition: proposal.decomposition,
      totalTime: proposal.totalTime,
      criticalPath: proposal.criticalPath,
      status: proposal.status,
      createdAt: proposal.createdAt,
      modifications: proposal.modifications
    }
  });
}

/**
 * Delete a proposal
 */
async function deleteProposal(req, res) {
  const { proposalId } = req.query;

  if (!proposalId) {
    return res.status(400).json({ error: 'Proposal ID is required' });
  }

  const deleted = proposals.delete(proposalId);
  
  if (!deleted) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  res.status(200).json({
    success: true,
    message: 'Proposal deleted'
  });
}
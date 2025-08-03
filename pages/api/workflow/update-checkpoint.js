/**
 * API endpoint to update checkpoint status
 * Automatically propagates completion status to parent task
 */

import HierarchyManager from '../../../lib/workflow/hierarchy-manager';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, checkpointId, status, validationResults } = req.body;

    if (!taskId || !checkpointId || !status) {
      return res.status(400).json({
        error: 'Missing required fields: taskId, checkpointId, and status are required'
      });
    }

    const validStatuses = ['pending', 'in-progress', 'complete', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const hierarchyManager = new HierarchyManager();

    // Update checkpoint and check task completion
    const result = await hierarchyManager.updateCheckpointStatus(
      taskId,
      checkpointId,
      status,
      validationResults
    );

    const response = {
      success: true,
      checkpointId,
      status,
      taskStatus: result.taskStatus,
      message: `Checkpoint ${checkpointId} updated to ${status}`
    };

    // If all checkpoints complete, notify about merge proposal
    if (result.allCheckpointsComplete) {
      response.mergeProposalReady = true;
      response.nextStep = `Review and approve merge proposal at /api/workflow/merge-proposal/${taskId}`;
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Error updating checkpoint:', error);

    res.status(500).json({
      error: 'Failed to update checkpoint',
      details: error.message
    });
  }
}

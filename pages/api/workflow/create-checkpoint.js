/**
 * API endpoint to create a checkpoint within a task
 * Checkpoints are atomic units of work that must link to their parent task
 */

import HierarchyManager from '../../../lib/workflow/hierarchy-manager';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, title, objective, validation } = req.body;

    if (!taskId || !title || !objective) {
      return res.status(400).json({
        error: 'Missing required fields: taskId, title, and objective are required'
      });
    }

    const hierarchyManager = new HierarchyManager();

    // Create the checkpoint
    const result = await hierarchyManager.createCheckpoint(taskId, {
      title,
      objective,
      validation: validation || {
        eslint: true,
        tests: true,
        accessibility: true,
        sacredPrinciples: true
      }
    });

    res.status(201).json({
      success: true,
      checkpointId: result.checkpointId,
      checkpointPath: result.checkpointPath,
      parentTask: result.parentTask,
      message: `Checkpoint ${result.checkpointId} created successfully under task ${taskId}`
    });

  } catch (error) {
    console.error('Error creating checkpoint:', error);

    if (error.message.includes('Task') && error.message.includes('not found')) {
      return res.status(404).json({
        error: error.message,
        hint: 'Ensure the task ID exists before creating checkpoints'
      });
    }

    res.status(500).json({
      error: 'Failed to create checkpoint',
      details: error.message
    });
  }
}

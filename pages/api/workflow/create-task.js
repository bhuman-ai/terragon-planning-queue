/**
 * API endpoint to create a new task with CLAUDE.md linkage
 * Enforces the sacred hierarchy: CLAUDE.md → task.md → checkpoint.md
 */

import HierarchyManager from '../../../lib/workflow/hierarchy-manager';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, description, objective, claudeMdSection, requirements } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        error: 'Missing required fields: title and description are required'
      });
    }

    const hierarchyManager = new HierarchyManager();

    // If no CLAUDE.md section provided, suggest relevant sections
    if (!claudeMdSection) {
      const suggestions = await hierarchyManager.suggestClaudeMdSection(title, description);

      return res.status(400).json({
        error: 'Task must reference a parent section in CLAUDE.md',
        suggestions,
        message: 'Please select one of the suggested sections or specify a custom section path'
      });
    }

    // Create the task with hierarchy enforcement
    const result = await hierarchyManager.createTask({
      title,
      description,
      objective,
      claudeMdSection,
      requirements
    });

    res.status(201).json({
      success: true,
      taskId: result.taskId,
      taskPath: result.taskPath,
      metadata: result.metadata,
      message: `Task ${result.taskId} created successfully with CLAUDE.md linkage`
    });

  } catch (error) {
    console.error('Error creating task:', error);

    if (error.message.includes('Invalid CLAUDE.md section')) {
      return res.status(400).json({
        error: error.message,
        hint: 'Use /api/workflow/claude-sections to list available sections'
      });
    }

    res.status(500).json({
      error: 'Failed to create task',
      details: error.message
    });
  }
}

/**
 * List all active tasks being monitored
 * Returns current status of autonomous task execution
 */

const fs = require('fs').promises;
const path = require('path');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const activeTasksDir = path.join(process.cwd(), 'data', 'active-tasks');
    
    // Check if directory exists
    try {
      await fs.access(activeTasksDir);
    } catch {
      return res.status(200).json({
        success: true,
        tasks: [],
        count: 0
      });
    }

    const files = await fs.readdir(activeTasksDir);
    const tasks = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const taskPath = path.join(activeTasksDir, file);
          const taskData = await fs.readFile(taskPath, 'utf-8');
          const task = JSON.parse(taskData);
          
          // Add summary info for UI
          tasks.push({
            id: task.id,
            title: task.title,
            status: task.status,
            createdAt: task.createdAt,
            currentStep: task.currentStep,
            lastActivity: task.lastActivity || task.createdAt,
            pauseReason: task.pauseReason,
            completedAt: task.completedAt,
            waitingForResponse: task.waitingForResponse
          });
        } catch (error) {
          console.error(`Error reading task file ${file}:`, error);
        }
      }
    }

    // Sort by creation date, newest first
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      tasks,
      count: tasks.length,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error listing active tasks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list active tasks',
      details: error.message
    });
  }
}
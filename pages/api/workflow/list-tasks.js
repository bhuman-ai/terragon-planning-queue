/**
 * API endpoint to list all tasks with their status and checkpoints
 */

import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tasksDir = path.join(process.cwd(), 'tasks');
    const tasks = [];

    // Check if tasks directory exists
    try {
      await fs.access(tasksDir);
    } catch {
      return res.status(200).json({
        success: true,
        tasks: [],
        message: 'No tasks directory found'
      });
    }

    // Read all task directories
    const entries = await fs.readdir(tasksDir);
    const taskDirs = entries.filter(entry => entry.startsWith('task-')).sort();

    // Load metadata for each task
    for (const taskDir of taskDirs) {
      try {
        const taskPath = path.join(tasksDir, taskDir);
        const metadataPath = path.join(taskPath, '.task-metadata.json');

        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

        // Extract task title from task.md if not in metadata
        let { title } = metadata;
        if (!title) {
          try {
            const taskMd = await fs.readFile(path.join(taskPath, 'task.md'), 'utf-8');
            const titleMatch = taskMd.match(/^#\s+(.+)$/m);
            title = titleMatch ? titleMatch[1].replace(/^Task \d+:\s*/, '') : 'Untitled Task';
          } catch {
            title = 'Untitled Task';
          }
        }

        tasks.push({
          taskId: metadata.taskId,
          taskDirName: metadata.taskDirName,
          title,
          status: metadata.status,
          claudeMdLink: metadata.claudeMdLink,
          checkpoints: metadata.checkpoints.map(c => ({
            id: c.id,
            title: c.title,
            status: c.status,
            validationResults: c.validationResults
          })),
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt
        });
      } catch (error) {
        console.error(`Error reading task ${taskDir}:`, error);
      }
    }

    // Sort by task ID
    tasks.sort((a, b) => a.taskId.localeCompare(b.taskId));

    res.status(200).json({
      success: true,
      tasks,
      total: tasks.length,
      statistics: {
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in-progress').length,
        readyForMerge: tasks.filter(t => t.status === 'ready-for-merge').length,
        complete: tasks.filter(t => t.status === 'complete' || t.status === 'approved-for-merge').length,
        rejected: tasks.filter(t => t.status === 'merge-rejected').length
      }
    });

  } catch (error) {
    console.error('Error listing tasks:', error);
    res.status(500).json({
      error: 'Failed to list tasks',
      details: error.message
    });
  }
}

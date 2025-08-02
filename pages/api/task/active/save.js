/**
 * Save task to active monitoring system
 * Called when a task starts execution and needs autonomous monitoring
 */

const fs = require('fs').promises;
const path = require('path');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, taskData } = req.body;

    if (!taskId || !taskData) {
      return res.status(400).json({ error: 'taskId and taskData are required' });
    }

    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    const activeTasksDir = path.join(dataDir, 'active-tasks');
    
    await fs.mkdir(activeTasksDir, { recursive: true });

    // Prepare task data for monitoring
    const monitoringTask = {
      id: taskId,
      title: taskData.title,
      description: taskData.description,
      approvedProposal: taskData.approvedProposal,
      terragonSessionId: taskData.terragonSessionId,
      terragonToken: taskData.terragonToken,
      status: 'executing',
      waitingForResponse: true,
      createdAt: new Date().toISOString(),
      lastProcessedMessageIndex: -1,
      currentStep: 0,
      conversationHistory: taskData.conversationHistory || [],
      userNotifications: {
        email: taskData.userEmail,
        phone: taskData.userPhone
      }
    };

    // Save to file
    const taskPath = path.join(activeTasksDir, `${taskId}.json`);
    await fs.writeFile(taskPath, JSON.stringify(monitoringTask, null, 2));

    console.log(`💾 Task ${taskId} saved for autonomous monitoring`);

    res.status(200).json({
      success: true,
      message: 'Task saved for monitoring',
      taskId,
      monitoringEnabled: true
    });

  } catch (error) {
    console.error('Error saving task for monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save task for monitoring',
      details: error.message
    });
  }
}
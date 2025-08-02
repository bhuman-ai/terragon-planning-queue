/**
 * Resume a paused task with user input
 * Called when user provides input for a paused autonomous task
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, userInput, resumeContext } = req.body;

    if (!taskId || !userInput) {
      return res.status(400).json({ error: 'taskId and userInput are required' });
    }

    // Load task from active monitoring
    const activeTasksDir = path.join(process.cwd(), 'data', 'active-tasks');
    const taskPath = path.join(activeTasksDir, `${taskId}.json`);
    
    let task;
    try {
      const taskData = await fs.readFile(taskPath, 'utf-8');
      task = JSON.parse(taskData);
    } catch (error) {
      return res.status(404).json({ error: 'Task not found in active monitoring' });
    }

    if (task.status !== 'paused') {
      return res.status(400).json({ error: 'Task is not in paused state' });
    }

    // Send user input to Terragon to resume execution
    try {
      const response = await axios.post(`${task.terragonEndpoint || process.env.TERRAGON_ENDPOINT}/${task.terragonSessionId}/messages`, {
        message: userInput,
        context: {
          resumed: true,
          pauseReason: task.pauseReason,
          userProvidedInput: true,
          ...resumeContext
        }
      }, {
        headers: {
          'Authorization': `Bearer ${task.terragonToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Update task status to resume autonomous execution
      task.status = 'executing';
      task.waitingForResponse = true;
      task.pauseReason = null;
      task.resumedAt = new Date().toISOString();
      task.lastActivity = new Date().toISOString();
      
      // Add user input to conversation history
      task.conversationHistory = task.conversationHistory || [];
      task.conversationHistory.push({
        role: 'user',
        content: userInput,
        timestamp: new Date().toISOString(),
        resumedFromPause: true,
        pauseReason: task.pauseReason
      });

      // Save updated task
      await fs.writeFile(taskPath, JSON.stringify(task, null, 2));

      console.log(`▶️ Task ${taskId} resumed with user input`);

      res.status(200).json({
        success: true,
        message: 'Task resumed successfully',
        taskId,
        status: 'executing',
        nextMonitoringCheck: '5 minutes'
      });

    } catch (terragonError) {
      console.error('Error sending resume message to Terragon:', terragonError);
      res.status(500).json({
        success: false,
        error: 'Failed to resume task execution',
        details: terragonError.message
      });
    }

  } catch (error) {
    console.error('Error resuming task:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume task',
      details: error.message
    });
  }
}
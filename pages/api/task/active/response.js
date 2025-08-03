/**
 * Handle responses from Discord bot for active tasks
 */

const fs = require('fs').promises;
const path = require('path');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, response, respondedBy, timestamp } = req.body;

    if (!taskId || !response) {
      return res.status(400).json({ error: 'taskId and response are required' });
    }

    // Load task data
    const tasksDir = path.join(process.cwd(), 'data', 'active-tasks');
    const taskPath = path.join(tasksDir, `${taskId}.json`);

    let taskData;
    try {
      const taskContent = await fs.readFile(taskPath, 'utf-8');
      taskData = JSON.parse(taskContent);
    } catch (error) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Add response to task data
    taskData.userResponses = taskData.userResponses || [];
    taskData.userResponses.push({
      question: taskData.pauseReason || 'Unknown question',
      response,
      respondedBy,
      timestamp: timestamp || new Date().toISOString()
    });

    // Update task status
    taskData.status = 'resuming';
    taskData.pauseReason = null;
    taskData.resumedAt = new Date().toISOString();
    taskData.waitingForResponse = false;

    // Generate instruction for Terragon based on user response
    const instruction = await generateTerragonInstruction(taskData, response);

    // Add instruction to task queue
    taskData.pendingInstructions = taskData.pendingInstructions || [];
    taskData.pendingInstructions.push({
      instruction,
      basedOnResponse: response,
      createdAt: new Date().toISOString()
    });

    // Save updated task
    await fs.writeFile(taskPath, JSON.stringify(taskData, null, 2));

    res.status(200).json({
      success: true,
      taskId,
      status: 'resuming',
      instruction,
      message: 'Response processed successfully'
    });

  } catch (error) {
    console.error('Error processing Discord response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process response',
      details: error.message
    });
  }
}

/**
 * Generate instruction for Terragon based on user's response
 */
async function generateTerragonInstruction(taskData, userResponse) {
  // If user said 'I don't know', provide a default instruction
  if (userResponse.toLowerCase() === 'i don't know') {
    return `Continue with the task using your best judgment. The user is unsure about: '${taskData.pauseReason}'. Proceed with standard implementation patterns.`;
  }

  // Otherwise, incorporate the user's response into the instruction
  const context = taskData.pauseReason || 'the current decision point';

  return `Based on user input regarding ${context}: '${userResponse}'.
Please incorporate this guidance into your implementation approach and continue with the task.`;
}

/**
 * Handle Discord bot responses and continue task execution
 */

import TaskMonitor from '../../../lib/task-monitor';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { taskId, userResponse, userId, messageId } = req.body;

  if (!taskId || !userResponse) {
    return res.status(400).json({ 
      error: 'Missing required fields: taskId and userResponse' 
    });
  }

  try {
    const monitor = new TaskMonitor();
    
    // Process the Discord response
    const result = await monitor.processDiscordResponse(taskId, userResponse);
    
    if (result.success) {
      console.log(`✅ Discord response processed for task ${taskId}`);
      
      return res.status(200).json({
        success: true,
        message: 'Response processed and sent to Terragon',
        task: {
          taskId: result.task.taskId,
          status: result.task.status,
          progress: result.task.progress
        }
      });
    } else {
      throw new Error('Failed to process response');
    }
    
  } catch (error) {
    console.error('Discord response processing error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process Discord response'
    });
  }
}
/**
 * Task Monitor Polling Endpoint
 * Called by Vercel cron job every 5 minutes to check active tasks
 */

export default async function handler(req, res) {
  // Verify cron secret for security
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('🔄 Task monitor check started at:', new Date().toISOString());

  try {
    // Get active tasks from KV storage
    let activeTasks = [];
    
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      const taskIds = await kv.lrange('active-tasks', 0, -1);
      
      // Process each active task
      for (const taskId of taskIds) {
        try {
          const task = await kv.get(`task:${taskId}`);
          if (!task) continue;
          
          // Only process tasks that are executing
          if (task.status === 'executing' && task.terragon?.taskId) {
            await checkTaskProgress(task, kv);
          }
          
          activeTasks.push({
            taskId: task.taskId,
            status: task.status,
            progress: task.progress
          });
        } catch (taskError) {
          console.error(`Error processing task ${taskId}:`, taskError);
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      checked: activeTasks.length,
      tasks: activeTasks,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Task monitor check error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Check progress of a single task
 */
async function checkTaskProgress(task, kv) {
  const { TaskMonitor } = await import('../../../lib/task-monitor');
  const monitor = new TaskMonitor();
  
  try {
    // Check if task needs user input
    const needsInput = await monitor.checkTaskNeedsInput(task);
    
    if (needsInput) {
      // Send Discord notification for user input
      await monitor.notifyUser(task, needsInput.question);
      
      // Update task status
      task.status = 'waiting_for_input';
      task.waitingFor = {
        question: needsInput.question,
        context: needsInput.context,
        since: new Date().toISOString()
      };
    } else {
      // Check task completion
      const isComplete = await monitor.checkTaskCompletion(task);
      
      if (isComplete) {
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        
        // Remove from active tasks
        await kv.lrem('active-tasks', 0, task.taskId);
        
        // Notify completion
        await monitor.notifyCompletion(task);
      } else {
        // Update progress if available
        const progress = await monitor.getTaskProgress(task);
        if (progress) {
          task.progress = progress;
        }
      }
    }
    
    // Save updated task
    await kv.set(`task:${task.taskId}`, task, { ex: 86400 * 7 });
    
  } catch (error) {
    console.error(`Error checking progress for task ${task.taskId}:`, error);
  }
}

// Export config for Vercel cron
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb'
    }
  }
};
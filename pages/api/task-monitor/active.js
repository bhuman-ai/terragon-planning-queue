/**
 * Get all active tasks for monitoring dashboard
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tasks = [];
    
    // Get tasks from KV storage if available
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      const taskIds = await kv.lrange('active-tasks', 0, -1);
      
      // Get each task's details
      for (const taskId of taskIds) {
        try {
          const task = await kv.get(`task:${taskId}`);
          if (task) {
            tasks.push({
              taskId: task.taskId,
              title: task.title,
              status: task.status,
              progress: task.progress,
              createdAt: task.createdAt,
              waitingFor: task.waitingFor,
              completedAt: task.completedAt
            });
          }
        } catch (error) {
          console.error(`Error fetching task ${taskId}:`, error);
        }
      }
    } else {
      // Fallback to filesystem if KV not available
      const TaskMonitor = await import('../../../lib/task-monitor');
      const monitor = new TaskMonitor.default();
      const activeTasks = await monitor.getActiveTasks();
      
      for (const task of activeTasks) {
        tasks.push({
          taskId: task.id || task.taskId,
          title: task.title,
          status: task.status,
          progress: task.progress,
          createdAt: task.createdAt,
          waitingFor: task.waitingFor,
          completedAt: task.completedAt
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      tasks,
      lastUpdated: new Date().toISOString(),
      count: tasks.length
    });
    
  } catch (error) {
    console.error('Error fetching active tasks:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      tasks: []
    });
  }
}
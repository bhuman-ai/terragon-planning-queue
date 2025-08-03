/**
 * Start monitoring a specific task
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { taskId } = req.body;

  if (!taskId) {
    return res.status(400).json({ error: 'taskId is required' });
  }

  try {
    // Add task to active monitoring list
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');

      // Check if task exists
      const task = await kv.get(`task:${taskId}`);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Add to active tasks list if not already there
      const activeTasks = await kv.lrange('active-tasks', 0, -1);
      if (!activeTasks.includes(taskId)) {
        await kv.lpush('active-tasks', taskId);
      }

      // Update task status
      task.status = 'monitoring';
      task.monitoringStarted = new Date().toISOString();
      await kv.set(`task:${taskId}`, task, { ex: 86400 * 7 });

      console.log(`✅ Started monitoring task: ${taskId}`);

      return res.status(200).json({
        success: true,
        message: `Task ${taskId} is now being monitored`,
        task: {
          taskId: task.taskId,
          status: task.status
        }
      });
    } else {
      // Fallback without KV
      console.log(`⚠️ KV not available, monitoring task locally: ${taskId}`);
      return res.status(200).json({
        success: true,
        message: `Task ${taskId} monitoring started (local only)`,
        warning: 'Persistence not available'
      });
    }

  } catch (error) {
    console.error('Start monitoring error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

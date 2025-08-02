/**
 * Server-Sent Events endpoint for real-time task updates
 */

export default async function handler(req, res) {
  const { taskId } = req.query;

  if (!taskId) {
    return res.status(400).json({ error: 'taskId is required' });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', taskId })}\n\n`);

  // Set up interval to send updates
  const interval = setInterval(async () => {
    try {
      // Get task from KV storage
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        const { kv } = await import('@vercel/kv');
        const task = await kv.get(`task:${taskId}`);
        
        if (task) {
          // Send task update
          res.write(`data: ${JSON.stringify({
            type: 'update',
            task: {
              taskId: task.taskId,
              status: task.status,
              progress: task.progress,
              waitingFor: task.waitingFor,
              completedAt: task.completedAt
            }
          })}\n\n`);
          
          // If task is completed, close the connection
          if (task.status === 'completed' || task.status === 'failed') {
            clearInterval(interval);
            res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
            res.end();
          }
        } else {
          // Task not found
          res.write(`data: ${JSON.stringify({ type: 'error', message: 'Task not found' })}\n\n`);
          clearInterval(interval);
          res.end();
        }
      }
    } catch (error) {
      console.error('SSE update error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    }
  }, 5000); // Send updates every 5 seconds

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
    console.log(`SSE connection closed for task ${taskId}`);
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
/**
 * Vercel Cron Job - Task Monitor for Autonomous Execution
 * Polls active tasks and continues execution when user is offline
 */

const TaskMonitor = require('../../../lib/task-monitor');

export default async function handler(req, res) {
  // Verify this is a Vercel Cron request
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log(`🔄 Task Monitor running at ${new Date().toISOString()}`);

  const monitor = new TaskMonitor({
    claudeApiKey: process.env.CLAUDE_API_KEY,
    perplexityApiKey: process.env.PERPLEXITY_API_KEY,
    terragonEndpoint: process.env.TERRAGON_ENDPOINT || 'https://terragon.ai/api/v1/sessions',
    notificationWebhook: process.env.NOTIFICATION_WEBHOOK
  });

  try {
    const results = await monitor.processActiveTasks();

    console.log(`✅ Task Monitor completed. Processed ${results.processed} tasks, ${results.continued} continued, ${results.paused} paused`);

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: results
    });
  } catch (error) {
    console.error('❌ Task Monitor failed:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

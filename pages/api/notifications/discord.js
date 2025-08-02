/**
 * Discord notification endpoint for Meta-Agent
 * Sends Discord messages when user input is needed during autonomous execution
 */

const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      message, 
      taskId, 
      taskTitle, 
      urgency = 'normal',
      webhookUrl = process.env.DISCORD_WEBHOOK_URL
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!webhookUrl) {
      return res.status(400).json({ error: 'Discord webhook URL not configured' });
    }

    // Create Discord embed for rich formatting
    const discordPayload = {
      username: 'Meta-Agent Bot',
      avatar_url: 'https://emoji.slack-edge.com/T0266FRGM/terragon/f5e3b0e6c0b5e0e6.png',
      embeds: [{
        title: urgency === 'urgent' ? '🚨 URGENT: Task Needs Input' : '🤖 Task Needs Input',
        description: message,
        color: urgency === 'urgent' ? 15158332 : 3447003, // Red for urgent, blue for normal
        fields: [
          {
            name: 'Task',
            value: taskTitle || 'Autonomous Task',
            inline: true
          },
          {
            name: 'Task ID',
            value: taskId || 'N/A',
            inline: true
          },
          {
            name: 'Action Required',
            value: `[Resume Task](${process.env.VERCEL_URL || 'https://terragon-vercel.vercel.app'}/task/${taskId}/resume)`,
            inline: false
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Meta-Agent Autonomous Execution',
          icon_url: 'https://emoji.slack-edge.com/T0266FRGM/claude/5e3b0e6c0b5e0e6.png'
        }
      }]
    };

    // Send to Discord
    const response = await axios.post(webhookUrl, discordPayload);

    console.log(`📱 Discord notification sent for task ${taskId}`);

    res.status(200).json({
      success: true,
      message: 'Discord notification sent successfully',
      taskId: taskId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Discord notification error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to send Discord notification',
      details: error.response?.data || error.message
    });
  }
}
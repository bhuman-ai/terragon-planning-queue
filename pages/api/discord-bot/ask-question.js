/**
 * API endpoint for Meta-Agent to ask questions via Discord Bot
 */

const MetaAgentDiscordBot = require('../../../lib/discord-bot/index.js');

// Initialize bot instance
let bot;

async function getBot() {
  if (!bot) {
    bot = new MetaAgentDiscordBot({
      token: process.env.DISCORD_BOT_TOKEN,
      channelId: process.env.DISCORD_CHANNEL_ID,
      baseUrl: process.env.VERCEL_URL || 'https://terragon-vercel.vercel.app'
    });

    // Start the bot if not already running
    try {
      await bot.start();
    } catch (error) {
      console.error('Failed to start Discord bot:', error);
      throw error;
    }
  }
  return bot;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, taskTitle, question, context, urgency } = req.body;

    if (!taskId || !question) {
      return res.status(400).json({ error: 'taskId and question are required' });
    }

    // Get or initialize the bot
    const discordBot = await getBot();

    // Send the question to Discord
    const messageId = await discordBot.askQuestion({
      taskId,
      taskTitle,
      question,
      context,
      urgency
    });

    console.log(`📤 Sent Discord question for task ${taskId}, message ID: ${messageId}`);

    res.status(200).json({
      success: true,
      messageId,
      message: 'Question sent to Discord successfully'
    });

  } catch (error) {
    console.error('Error sending Discord question:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send Discord question',
      details: error.message
    });
  }
}

#!/usr/bin/env node

/**
 * Start the Meta-Agent Discord Bot
 */

const MetaAgentDiscordBot = require('./index.js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const bot = new MetaAgentDiscordBot({
  token: process.env.DISCORD_BOT_TOKEN,
  channelId: process.env.DISCORD_CHANNEL_ID,
  baseUrl: process.env.VERCEL_URL || 'http://localhost:3000'
});

// Start the bot
bot.start()
  .then(() => {
    console.log('🚀 Meta-Agent Discord Bot is running!');
    console.log(`📍 Monitoring channel: ${process.env.DISCORD_CHANNEL_ID}`);
    console.log(`🔗 Connected to: ${process.env.VERCEL_URL || 'http://localhost:3000'}`);
  })
  .catch(error => {
    console.error('❌ Failed to start Discord bot:', error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Discord bot...');
  bot.client.destroy();
  process.exit(0);
});

// Keep the process alive
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

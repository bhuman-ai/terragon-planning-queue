/**
 * Discord Bot for Meta-Agent Interactive Responses
 *
 * This bot allows the Meta-Agent to ask questions during autonomous execution
 * and receive responses that guide the Terragon agent.
 */

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

class MetaAgentDiscordBot {
  constructor(config = {}) {
    this.token = config.token || process.env.DISCORD_BOT_TOKEN;
    this.channelId = config.channelId || process.env.DISCORD_CHANNEL_ID;
    this.baseUrl = config.baseUrl || process.env.VERCEL_URL || 'https://terragon-vercel.vercel.app';

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
      ]
    });

    this.pendingQuestions = new Map(); // taskId -> question data
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on('ready', () => {
      console.log(`🤖 Meta-Agent Discord Bot logged in as ${this.client.user.tag}`);
      this.updateStatus('Ready to assist with tasks');
    });

    this.client.on('messageCreate', async (message) => {
      // Ignore bot messages
      if (message.author.bot) return;

      // Check if this is a response to a pending question
      const pendingQuestion = Array.from(this.pendingQuestions.values())
        .find(q => q.messageId === message.reference?.messageId);

      if (pendingQuestion) {
        await this.handleQuestionResponse(pendingQuestion, message);
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;

      const [action, taskId] = interaction.customId.split(':');

      if (action === 'dontknow') {
        await this.handleDontKnow(interaction, taskId);
      }
    });
  }

  async start() {
    if (!this.token) {
      throw new Error('Discord bot token is required');
    }

    await this.client.login(this.token);
  }

  /**
   * Send a question to Discord and wait for response
   */
  async askQuestion(taskData) {
    const { taskId, taskTitle, question, context, urgency = 'normal' } = taskData;

    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel) {
      throw new Error(`Channel ${this.channelId} not found`);
    }

    // Create embed for the question
    const embed = new EmbedBuilder()
      .setTitle(`${urgency === 'urgent' ? '🚨 ' : '🤖 '}Task Requires Input`)
      .setDescription(question)
      .setColor(urgency === 'urgent' ? 0xED4245 : 0x5865F2)
      .addFields([
        { name: 'Task', value: taskTitle || 'Autonomous Task', inline: true },
        { name: 'Task ID', value: taskId, inline: true }
      ])
      .setTimestamp()
      .setFooter({ text: 'Reply to this message with your answer' });

    if (context) {
      embed.addFields({ name: 'Context', value: context.substring(0, 1024) });
    }

    // Add "I don't know" button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`dontknow:${taskId}`)
          .setLabel("🤷 I don't know")
          .setStyle(ButtonStyle.Secondary)
      );

    // Send the message
    const message = await channel.send({
      content: `<@${channel.guild.ownerId}> - Meta-Agent needs your input:`,
      embeds: [embed],
      components: [row]
    });

    // Store pending question
    this.pendingQuestions.set(taskId, {
      taskId,
      taskTitle,
      question,
      messageId: message.id,
      timestamp: new Date()
    });

    return message.id;
  }

  /**
   * Handle user's response to a question
   */
  async handleQuestionResponse(pendingQuestion, message) {
    const { taskId, taskTitle } = pendingQuestion;

    console.log(`📥 Received response for task ${taskId}: ${message.content}`);

    try {
      // Send response back to Meta-Agent
      const response = await axios.post(`${this.baseUrl}/api/discord-bot/response`, {
        taskId,
        userResponse: message.content,
        userId: message.author.id,
        messageId: message.id
      });

      // Acknowledge the response
      await message.react('✅');

      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Response Received')
            .setDescription(`Your input has been sent to the Meta-Agent for task: ${taskTitle}`)
            .setColor(0x57F287)
            .setTimestamp()
        ]
      });

      // Remove from pending questions
      this.pendingQuestions.delete(taskId);

    } catch (error) {
      console.error('Failed to send response to Meta-Agent:', error);
      await message.react('❌');
      await message.reply('Failed to process your response. Please try again.');
    }
  }

  /**
   * Handle "I don't know" button click
   */
  async handleDontKnow(interaction, taskId) {
    const pendingQuestion = this.pendingQuestions.get(taskId);
    if (!pendingQuestion) {
      await interaction.reply({
        content: 'This question has already been answered or expired.',
        ephemeral: true
      });
      return;
    }

    try {
      // Send "I don't know" response
      await axios.post(`${this.baseUrl}/api/discord-bot/response`, {
        taskId,
        userResponse: "I don't know",
        userId: interaction.user.id,
        messageId: interaction.message.id
      });

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle('Response: I don\'t know')
            .setDescription('The Meta-Agent will proceed with default assumptions.')
            .setColor(0xFEE75C)
            .setTimestamp()
        ],
        components: [] // Remove buttons
      });

      this.pendingQuestions.delete(taskId);

    } catch (error) {
      console.error("Failed to send 'I don't know' response:", error);
      await interaction.reply({
        content: 'Failed to process your response. Please try again.',
        ephemeral: true
      });
    }
  }

  /**
   * Update bot status
   */
  updateStatus(status) {
    this.client.user.setPresence({
      activities: [{ name: status }],
      status: 'online'
    });
  }

  /**
   * Send task completion notification
   */
  async notifyTaskComplete(taskData) {
    const { taskId, taskTitle, result, duration } = taskData;

    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('✅ Task Completed');
      .setDescription(`Task '${taskTitle}' has been completed successfully`)
      .setColor(0x57F287)
      .addFields([
        { name: 'Task ID', value: taskId, inline: true },
        { name: 'Duration', value: duration || 'N/A', inline: true },
        { name: 'Result', value: result?.substring(0, 1024) || 'Task completed successfully' }
      ])
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }

  /**
   * Send error notification
   */
  async notifyError(taskData) {
    const { taskId, taskTitle, error } = taskData;

    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('❌ Task Error');
      .setDescription(`An error occurred while executing task "${taskTitle}"`)
      .setColor(0xED4245)
      .addFields([
        { name: 'Task ID', value: taskId, inline: true },
        { name: 'Error', value: error?.substring(0, 1024) || 'Unknown error' }
      ])
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }
}

module.exports = MetaAgentDiscordBot;
